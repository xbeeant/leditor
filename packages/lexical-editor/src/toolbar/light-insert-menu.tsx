import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes } from 'lexical';
import {
  ChevronDown,
  File,
  Image as ImageIcon,
  type Pilcrow,
  SquarePlus,
  Table as TableIcon,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { $createTable, insertBlockAfter } from '../commands';
import { type EditorConfig, useEditorConfig, useLocale } from '../context';
import { type Locale, t } from '../i18n';
import { uploadAttachment } from '../media';
import { ImageModal } from '../modals';
import { $createImageNode } from '../nodes';
import { $createFileNode } from '../nodes';
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

function getSections(locale: Locale, config: EditorConfig): InsertSection[] {
  const embed = config?.embed;
  const hasMedia = !!embed?.attachment?.action;

  const sections: InsertSection[] = [
    {
      title: '',
      items: [
        {
          type: 'table',
          label: t(locale, 'insertTable'),
          icon: TableIcon,
        },
      ],
    },
  ];

  if (hasMedia) {
    sections.push({
      title: t(locale, 'insertMultimedia'),
      items: [
        {
          type: 'image' as InsertBlockType,
          label: t(locale, 'insertImage'),
          icon: ImageIcon,
        },
        {
          type: 'file' as InsertBlockType,
          label: t(locale, 'insertFile'),
          icon: File,
        },
      ],
    });
  }

  return sections.filter((s) => s.items.length > 0);
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
  const right = getSections(locale, config);

  const result: SectionWithColumn[] = [];

  // Interleave left and right sections by index
  const maxLen = right.length;
  for (let i = 0; i < maxLen; i++) {
    if (i < right.length) result.push({ column: 'left', section: right[i] });
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

export function LightInsertMenu() {
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
        case 'image': {
          setImageCursorPosition(getCursorPosition());
          setImageModalOpen(true);
          closeMenu();
          break;
        }
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
            className="h-36 w-50 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
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
    </>
  );
}
