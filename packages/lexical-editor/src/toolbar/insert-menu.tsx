import { $createCodeNode } from '@lexical/code-core';
import { $createListItemNode, $createListNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $getSelection, $insertNodes, $isRangeSelection } from 'lexical';
import {
  ChevronDown,
  Code,
  File,
  GitFork,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as ImageIcon,
  LayoutGrid,
  List,
  ListChecks,
  ListOrdered,
  ListTodo,
  ListTree,
  Minus,
  Music,
  Paintbrush,
  Pilcrow,
  Quote,
  SquarePlus,
  Table as TableIcon,
  Video,
  Workflow,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import {
  $createTable,
  insertBlockAfter,
  insertBlockWithParagraphAfter,
  insertParagraphAfter,
} from '../commands';
import { type EditorConfig, useEditorConfig, useLocale } from '../context';
import { type Locale, t } from '../i18n';
import { uploadAttachment } from '../media';
import { EquationModal, ImageModal } from '../modals';
import { $createEquationNode, $createImageNode } from '../nodes';
import { $createVideoNode } from '../nodes';
import { $createAudioNode } from '../nodes';
import { $createFileNode } from '../nodes';
import { $createListStyleNode, type ExtendedListType } from '../nodes';
import { INSERT_CALLOUT_COMMAND } from '../plugins';
import { INSERT_CODE_DRAWING_COMMAND } from '../plugins';
import { INSERT_DRAWIO_COMMAND } from '../plugins';
import { INSERT_MERMAID_COMMAND } from '../plugins';
import { INSERT_MIND_COMMAND } from '../plugins';
import { TableSizePicker } from './table-size-picker';
import { ToolbarPopup } from './toolbar-popup';
import type { InsertBlockType } from './types';

interface InsertItem {
  type: InsertBlockType;
  label: string;
  icon: typeof Pilcrow;
  hideLabel?: boolean;
}

interface InsertSection {
  title: string;
  items: InsertItem[];
}

/** Left column sections */
function getLeftSections(locale: Locale): InsertSection[] {
  return [
    {
      title: t(locale, 'insertBaseBlock'),
      items: [
        {
          type: 'paragraph',
          label: t(locale, 'insertParagraph'),
          icon: Pilcrow,
        },
        { type: 'h1', label: t(locale, 'insertH1'), icon: Heading1 },
        { type: 'h2', label: t(locale, 'insertH2'), icon: Heading2 },
        { type: 'h3', label: t(locale, 'insertH3'), icon: Heading3 },
        { type: 'h4', label: t(locale, 'insertH4'), icon: Heading4 },
        { type: 'h5', label: t(locale, 'insertH5'), icon: Heading5 },
        { type: 'h6', label: t(locale, 'insertH6'), icon: Heading6 },
      ],
    },
    {
      title: '',
      items: [
        {
          type: 'table',
          label: t(locale, 'insertTable'),
          icon: TableIcon,
        },
        {
          type: 'code',
          label: t(locale, 'insertCodeBlock'),
          icon: Code,
        },
        {
          type: 'quote',
          label: t(locale, 'insertQuote'),
          icon: Quote,
        },
        {
          type: 'divider',
          label: t(locale, 'insertDivider'),
          icon: Minus,
        },
      ],
    },
    {
      title: t(locale, 'insertList'),
      items: [
        { type: 'bullet', label: t(locale, 'insertBulletList'), icon: List },
        {
          type: 'number',
          label: t(locale, 'insertNumberedList'),
          icon: ListOrdered,
        },
        {
          type: 'check',
          label: t(locale, 'insertCheckList'),
          icon: ListChecks,
        },
      ],
    },
  ];
}

/** Right column sections */
function getRightSections(
  locale: Locale,
  config: EditorConfig,
): InsertSection[] {
  const embed = config?.embed;
  const story = config?.story;
  const hasMedia = !!embed?.attachment?.action;

  const advancedItems: InsertItem[] = [
    {
      type: 'outline' as InsertBlockType,
      label: t(locale, 'insertOutline'),
      icon: ListTree,
    },
    {
      type: 'codeDrawing' as InsertBlockType,
      label: t(locale, 'insertCodeDrawing'),
      icon: Paintbrush,
    },
  ];
  if (embed?.drawio) {
    advancedItems.push({
      type: 'drawio' as InsertBlockType,
      label: t(locale, 'insertUmlDiagram'),
      icon: GitFork,
    });
  }
  if (embed?.mind?.url) {
    advancedItems.push({
      type: 'mind' as InsertBlockType,
      label: t(locale, 'insertMind'),
      icon: Workflow,
    });
  }

  const rightSections: InsertSection[] = [];

  if (hasMedia) {
    rightSections.push({
      title: t(locale, 'insertMultimedia'),
      items: [
        {
          type: 'image' as InsertBlockType,
          label: t(locale, 'insertImage'),
          icon: ImageIcon,
        },
        {
          type: 'video' as InsertBlockType,
          label: t(locale, 'insertVideo'),
          icon: Video,
        },
        {
          type: 'audio' as InsertBlockType,
          label: t(locale, 'insertAudio'),
          icon: Music,
        },
        {
          type: 'file' as InsertBlockType,
          label: t(locale, 'insertFile'),
          icon: File,
        },
      ],
    });
  }
  rightSections.push({
    title: t(locale, 'insertAdvanced'),
    items: advancedItems,
  });

  if (story?.item || story?.list) {
    const storyItems: InsertItem[] = [];
    if (story?.item) {
      storyItems.push({
        type: 'projectCard' as InsertBlockType,
        label: t(locale, 'insertProjectCard'),
        icon: LayoutGrid,
      });
    }
    if (story?.list) {
      storyItems.push({
        type: 'projectList' as InsertBlockType,
        label: t(locale, 'insertProjectList'),
        icon: ListTodo,
      });
    }
    rightSections.push({
      title: '',
      items: storyItems,
    });
  }

  return rightSections.filter((s) => s.items.length > 0);
}

/** Get all sections flattened with column info for rendering */
interface SectionWithColumn {
  column: 'left' | 'right';
  section: InsertSection;
}

function getAllSections(
  locale: Locale,
  config: EditorConfig,
): SectionWithColumn[] {
  const left = getLeftSections(locale);
  const right = getRightSections(locale, config);

  const result: SectionWithColumn[] = [];

  // Interleave left and right sections by index
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < left.length) result.push({ column: 'left', section: left[i] });
    if (i < right.length) result.push({ column: 'right', section: right[i] });
  }

  return result;
}

/** 根据 MIME 类型判断应创建的节点类型 */
function getInsertType(file: File): InsertBlockType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

/** 获取光标坐标，用于定位弹窗 */
function getCursorPosition(): { x: number; y: number } | null {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  }
  return null;
}

export function InsertMenu() {
  const [editor] = useLexicalComposerContext();
  const editorConfig = useEditorConfig();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageCursorPosition, setImageCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [equationModalOpen, setEquationModalOpen] = useState(false);
  const [equationModalInline, setEquationModalInline] = useState(false);
  const [equationCursorPosition, setEquationCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setOpen(false);
    setTablePickerOpen(false);
  };

  /** 处理媒体文件上传 */
  const handleMediaUpload = useCallback(
    (file: File, type: InsertBlockType) => {
      const attachment = editorConfig?.embed?.attachment;
      if (!attachment?.action) {
        alert(t(locale, 'uploadNotConfigured'));
        return;
      }

      setUploadingMedia(true);
      uploadAttachment(file, attachment)
        .then((result) => {
          editor.update(() => {
            switch (type) {
              case 'image':
                $insertNodes([
                  $createImageNode({
                    src: result.url,
                    altText: result.filename,
                  }),
                ]);
                break;
              case 'video':
                $insertNodes([$createVideoNode({ src: result.url })]);
                break;
              case 'audio':
                $insertNodes([$createAudioNode({ src: result.url })]);
                break;
              default:
                $insertNodes([
                  $createFileNode({
                    url: result.url,
                    filename: result.filename,
                    size: result.size,
                  }),
                ]);
            }
          });
          closeMenu();
        })
        .catch(() => {
          alert(t(locale, 'uploadFailed'));
        })
        .finally(() => {
          setUploadingMedia(false);
        });
    },
    [editorConfig, editor, locale],
  );

  /** 触发文件选择器 */
  const triggerFileInput = useCallback(
    (accept: string) => {
      closeMenu();
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    },
    [closeMenu],
  );

  /** 文件选择器变化事件 */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const type = getInsertType(file);
      handleMediaUpload(file, type);
      // 重置 input 以便下次选择同一文件
      e.target.value = '';
    },
    [handleMediaUpload],
  );

  const insertTable = useCallback(
    (rows: number, cols: number) => {
      insertBlockAfter(editor, () => $createTable(cols, rows));
    },
    [editor],
  );

  /** 根据 blockType 插入对应节点 */
  const handleBlockInsert = useCallback(
    (type: InsertBlockType) => {
      switch (type) {
        case 'paragraph':
          insertParagraphAfter(editor);
          break;
        case 'h1':
          insertBlockAfter(editor, () => $createHeadingNode('h1'));
          break;
        case 'h2':
          insertBlockAfter(editor, () => $createHeadingNode('h2'));
          break;
        case 'h3':
          insertBlockAfter(editor, () => $createHeadingNode('h3'));
          break;
        case 'h4':
          insertBlockAfter(editor, () => $createHeadingNode('h4'));
          break;
        case 'h5':
          insertBlockAfter(editor, () => $createHeadingNode('h5'));
          break;
        case 'h6':
          insertBlockAfter(editor, () => $createHeadingNode('h6'));
          break;
        case 'quote':
          insertBlockAfter(editor, () => $createQuoteNode());
          break;
        case 'code':
          insertBlockAfter(editor, () => $createCodeNode());
          break;
        case 'bullet':
        case 'number':
        case 'check':
          insertBlockAfter(editor, () => {
            const list = $createListNode(
              type as Parameters<typeof $createListNode>[0],
            );
            list.append($createListItemNode());
            return list;
          });
          break;
        case 'lower-alpha':
        case 'upper-alpha':
        case 'lower-roman':
        case 'upper-roman':
          insertBlockAfter(editor, () => {
            const list = $createListStyleNode(type as ExtendedListType);
            list.append($createListItemNode());
            return list;
          });
          break;
        case 'divider':
          insertBlockAfter(editor, () => $createHorizontalRuleNode());
          break;
        case 'image': {
          setImageCursorPosition(getCursorPosition());
          setImageModalOpen(true);
          closeMenu();
          break;
        }
        case 'equation': {
          setEquationCursorPosition(getCursorPosition());
          setEquationModalInline(false);
          setEquationModalOpen(true);
          closeMenu();
          break;
        }
        case 'inlineEquation': {
          setEquationCursorPosition(getCursorPosition());
          setEquationModalInline(true);
          setEquationModalOpen(true);
          closeMenu();
          break;
        }
        case 'mermaid':
          editor.dispatchCommand(
            INSERT_MERMAID_COMMAND,
            t(locale, 'mermaidSampleContent'),
          );
          closeMenu();
          break;
        case 'callout':
          editor.dispatchCommand(INSERT_CALLOUT_COMMAND, { icon: 'note' });
          closeMenu();
          break;
        case 'codeDrawing':
          editor.dispatchCommand(INSERT_CODE_DRAWING_COMMAND, undefined);
          closeMenu();
          break;
        case 'drawio':
        case 'umlDiagram':
          editor.dispatchCommand(INSERT_DRAWIO_COMMAND, undefined);
          closeMenu();
          break;
        case 'mind':
          editor.dispatchCommand(INSERT_MIND_COMMAND, undefined);
          closeMenu();
          break;
        default:
          break;
      }
    },
    [editor, locale],
  );

  /** 图片确认 */
  const handleImageConfirm = useCallback(
    (src: string, altText: string) => {
      insertBlockAfter(editor, () => $createImageNode({ src, altText }));
    },
    [editor],
  );

  /** 公式确认 */
  const handleEquationConfirm = useCallback(
    (equation: string) => {
      if (equationModalInline) {
        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          selection.insertNodes([$createEquationNode(equation, true)]);
        });
        editor.focus();
        return;
      }
      insertBlockWithParagraphAfter(editor, () =>
        $createEquationNode(equation, equationModalInline),
      );
    },
    [editor, equationModalInline],
  );

  /** 处理区块项点击：media/file 触发上传，table 打开尺寸选择，其余调用 handleBlockInsert */
  const handleSectionClick = useCallback(
    (type: InsertBlockType) => {
      if (type === 'table') {
        setTablePickerOpen(true);
        return;
      }
      if (['image', 'video', 'audio', 'file'].includes(type)) {
        const acceptMap: Record<string, string> = {
          image: 'image/*',
          video: 'video/*',
          audio: 'audio/*',
          file: '*/*',
        };
        triggerFileInput(acceptMap[type]);
        return;
      }
      handleBlockInsert(type);
    },
    [handleBlockInsert, triggerFileInput],
  );

  /** 渲染区块项按钮 */
  const renderSectionItems = useCallback(
    (items: InsertItem[]) =>
      items.map((item) => (
        <button
          key={item.type}
          type="button"
          role="menuitem"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleSectionClick(item.type)}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 ${
            item.hideLabel ? 'justify-center gap-0.5' : ''
          }`}
        >
          <item.icon size={16} className="shrink-0 text-gray-500" />
          {item.hideLabel ? null : item.label}
        </button>
      )),
    [handleSectionClick],
  );

  return (
    <>
      {/* 隐藏的文件选择器，点击菜单项时触发 */}
      <input
        ref={fileInputRef}
        type="file"
        className="fixed -left-9999 -top-9999 w-0"
        onChange={handleFileInputChange}
        disabled={uploadingMedia}
      />

      <div ref={ref} className="relative">
        <button
          type="button"
          title={t(locale, 'insert')}
          aria-label={t(locale, 'insert')}
          aria-haspopup="menu"
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300"
        >
          <SquarePlus size={18} />
          <span>{t(locale, 'insert')}</span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ToolbarPopup
            anchorRef={ref}
            open={open}
            onClose={closeMenu}
            className="h-72 w-100 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {tablePickerOpen ? (
              <div className="h-72 p-4">
                <TableSizePicker
                  onSelect={(rows, cols) => {
                    insertTable(rows, cols);
                    closeMenu();
                  }}
                  onCancel={() => setTablePickerOpen(false)}
                />
              </div>
            ) : (
              <div className="flex h-full">
                {/* Left column */}
                <div className="flex-1 overflow-y-auto border-r border-gray-100 pr-1">
                  {getAllSections(locale, editorConfig)
                    .filter((s) => s.column === 'left')
                    .map(({ section }) => (
                      <div key={section.title || 'left-section'}>
                        {section.title && (
                          <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                            {section.title}
                          </div>
                        )}
                        {renderSectionItems(section.items)}
                      </div>
                    ))}
                </div>

                {/* Right column */}
                <div className="flex-1 overflow-y-auto pl-1">
                  {getAllSections(locale, editorConfig)
                    .filter((s) => s.column === 'right')
                    .map(({ section }) => (
                      <div key={section.title || 'right-section'}>
                        {section.title && (
                          <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                            {section.title}
                          </div>
                        )}
                        {renderSectionItems(section.items)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </ToolbarPopup>
        )}
      </div>

      {/* 图片弹窗 */}
      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onConfirm={handleImageConfirm}
        cursorPosition={imageCursorPosition}
      />

      {/* 公式弹窗 */}
      <EquationModal
        open={equationModalOpen}
        onClose={() => setEquationModalOpen(false)}
        onConfirm={handleEquationConfirm}
        cursorPosition={equationCursorPosition}
      />
    </>
  );
}
