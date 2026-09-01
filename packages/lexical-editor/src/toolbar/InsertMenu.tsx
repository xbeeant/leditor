import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import {
  ChevronDown,
  Code,
  File,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  Info,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Music,
  Paintbrush,
  Pilcrow,
  Quote,
  Sigma,
  SquarePlus,
  Table as TableIcon,
  Video,
  Workflow,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { insertBlockWithParagraphAfter } from '../commands';
import { useEmbedConfig } from '../embed';
import { type Locale, t } from '../i18n';
import { uploadAttachment } from '../media';
import { $createImageNode } from '../nodes';
import { $createVideoNode } from '../nodes';
import { $createAudioNode } from '../nodes';
import { $createFileNode } from '../nodes';
import { TableSizePicker } from './TableSizePicker';
import { ToolbarPopup } from './ToolbarPopup';
import type { InsertBlockType } from './types';

interface InsertMenuProps {
  onInsert: (type: InsertBlockType) => void;
  onInsertTable: (rows: number, cols: number) => void;
}

interface InsertItem {
  type: InsertBlockType;
  label: string;
  icon: typeof Pilcrow;
}

interface InsertSection {
  title: string;
  items: InsertItem[];
}

function getSections(locale: Locale): InsertSection[] {
  return [
    {
      title: t(locale, 'insertBlocks'),
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
        { type: 'quote', label: t(locale, 'insertQuote'), icon: Quote },
        { type: 'code', label: t(locale, 'insertCodeBlock'), icon: Code },
      ],
    },
    {
      title: t(locale, 'insertLists'),
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
    {
      title: t(locale, 'insertObjects'),
      items: [
        { type: 'table', label: t(locale, 'insertTable'), icon: TableIcon },
        { type: 'divider', label: t(locale, 'insertDivider'), icon: Minus },
        { type: 'image', label: t(locale, 'insertImage'), icon: ImageIcon },
        { type: 'video', label: t(locale, 'insertVideo'), icon: Video },
        { type: 'audio', label: t(locale, 'insertAudio'), icon: Music },
        { type: 'file', label: t(locale, 'insertFile'), icon: File },
        { type: 'equation', label: t(locale, 'insertEquation'), icon: Sigma },
        {
          type: 'inlineEquation',
          label: t(locale, 'insertInlineEquation'),
          icon: Sigma,
        },
        { type: 'mermaid', label: t(locale, 'insertMermaid'), icon: Workflow },
        { type: 'callout', label: t(locale, 'insertCallout'), icon: Info },
        {
          type: 'codeDrawing',
          label: t(locale, 'insertCodeDrawing'),
          icon: Paintbrush,
        },
        { type: 'drawio', label: t(locale, 'insertDrawio'), icon: Workflow },
        { type: 'mind', label: t(locale, 'insertMind'), icon: Workflow },
      ],
    },
  ];
}

/** 根据 MIME 类型判断应创建的节点类型 */
function getInsertType(file: File): InsertBlockType {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

export function InsertMenu({ onInsert, onInsertTable }: InsertMenuProps) {
  const [editor] = useLexicalComposerContext();
  const embedConfig = useEmbedConfig();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  /** 获取编辑器内光标位置，用于定位弹窗 */
  const getCursorPosition = useCallback((): { x: number; y: number } | null => {
    const editorRoot = editor.getRootElement();

    // 1. 浏览器实时选区
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0 && editorRoot) {
      const range = domSelection.getRangeAt(0);
      if (editorRoot.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.bottom };
      }
    }

    // 2. 从 Lexical 选区锚点节点定位
    let pos: { x: number; y: number } | null = null;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const element = editor.getElementByKey(
          selection.anchor.getNode().getKey(),
        );
        if (element) {
          const rect = element.getBoundingClientRect();
          pos = { x: rect.left + rect.width / 2, y: rect.bottom };
        }
      }
    });
    if (pos) return pos;

    // 3. 兜底：编辑器中心偏上
    if (editorRoot) {
      const editorRect = editorRoot.getBoundingClientRect();
      return {
        x: editorRect.left + editorRect.width / 2,
        y: editorRect.top + Math.min(60, editorRect.height / 3),
      };
    }
    return null;
  }, [editor]);

  const closeMenu = () => {
    setOpen(false);
    setTablePickerOpen(false);
  };

  /** 处理媒体文件上传 */
  const handleMediaUpload = useCallback(
    (file: File, type: InsertBlockType) => {
      const attachment = embedConfig?.attachment;
      if (!attachment?.action) {
        alert(t(locale, 'uploadNotConfigured'));
        return;
      }

      setUploadingMedia(true);
      uploadAttachment(file, attachment)
        .then((result) => {
          insertBlockWithParagraphAfter(editor, () => {
            switch (type) {
              case 'image':
                return $createImageNode({
                  src: result.url,
                  altText: result.filename,
                });
              case 'video':
                return $createVideoNode({ src: result.url });
              case 'audio':
                return $createAudioNode({ src: result.url });
              default:
                return $createFileNode({
                  url: result.url,
                  filename: result.filename,
                  size: result.size,
                });
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
    [embedConfig, editor, locale],
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
          className="flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-blue-400"
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
            className="max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {tablePickerOpen ? (
              <TableSizePicker
                onSelect={(rows, cols) => {
                  onInsertTable(rows, cols);
                  closeMenu();
                }}
                onCancel={() => setTablePickerOpen(false)}
              />
            ) : (
              getSections(locale).map((section) => (
                <div key={section.title}>
                  <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {section.title}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      role="menuitem"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (item.type === 'table') {
                          setTablePickerOpen(true);
                          return;
                        }
                        // 图片/视频/音频/文件：直接弹出系统文件选择器
                        if (item.type === 'image') {
                          triggerFileInput('image/*');
                          return;
                        }
                        if (item.type === 'video') {
                          triggerFileInput('video/*');
                          return;
                        }
                        if (item.type === 'audio') {
                          triggerFileInput('audio/*');
                          return;
                        }
                        if (item.type === 'file') {
                          triggerFileInput('*/*');
                          return;
                        }
                        onInsert(item.type);
                        closeMenu();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <item.icon size={16} className="shrink-0 text-gray-500" />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </ToolbarPopup>
        )}
      </div>
    </>
  );
}
