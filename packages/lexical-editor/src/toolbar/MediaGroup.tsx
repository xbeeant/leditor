import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { File, Image, Music, Video } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { insertBlockWithParagraphAfter } from '../commands';
import { useEmbedConfig } from '../embed';
import { t } from '../i18n';
import { uploadAttachment } from '../media';
import { ImageModal } from '../modals';
import { $createImageNode } from '../nodes';
import { $createVideoNode } from '../nodes';
import { $createAudioNode } from '../nodes';
import { $createFileNode } from '../nodes';
import { ToolbarPopup } from './ToolbarPopup';

/** 多媒体插入类型 */
type MediaType = 'image' | 'video' | 'audio' | 'file';

export function MediaGroup() {
  const [editor] = useLexicalComposerContext();
  const embedConfig = useEmbedConfig();
  const locale = useLocale();

  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageCursor, setImageCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const ref = useRef<HTMLDivElement>(null);

  /** 获取编辑器内光标位置 */
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

  /** 打开图片 URL 输入弹窗 */
  const handleImageClick = useCallback(() => {
    setImageCursor(getCursorPosition());
    setImageModalOpen(true);
    setMediaType(null);
  }, [getCursorPosition]);

  /** 处理图片确认 */
  const handleImageConfirm = useCallback(
    (src: string, altText: string) => {
      insertBlockWithParagraphAfter(editor, () =>
        $createImageNode({ src, altText }),
      );
      setImageModalOpen(false);
    },
    [editor],
  );

  /** 处理文件上传 */
  const handleFileUpload = useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement>,
      type: 'video' | 'audio' | 'file',
    ) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const attachment = embedConfig?.attachment;
      if (!attachment?.action) {
        alert(t(locale, 'uploadNotConfigured'));
        return;
      }

      setUploading(true);
      uploadAttachment(file, attachment)
        .then((result) => {
          if (type === 'video') {
            insertBlockWithParagraphAfter(editor, () =>
              $createVideoNode({ src: result.url }),
            );
          } else if (type === 'audio') {
            insertBlockWithParagraphAfter(editor, () =>
              $createAudioNode({ src: result.url }),
            );
          } else {
            insertBlockWithParagraphAfter(editor, () =>
              $createFileNode({
                url: result.url,
                filename: result.filename,
                size: result.size,
              }),
            );
          }
        })
        .catch(() => {
          alert(t(locale, 'uploadFailed'));
        })
        .finally(() => {
          setUploading(false);
          setMediaType(null);
          const input = event.target as HTMLInputElement;
          input.value = '';
        });
    },
    [embedConfig, editor, locale],
  );

  return (
    <>
      <div ref={ref} className="relative">
        <ToolbarPopup
          anchorRef={ref}
          open={mediaType !== null}
          onClose={() => setMediaType(null)}
          className="rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                handleImageClick();
                setMediaType(null);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              title={t(locale, 'insertImage')}
            >
              <Image size={16} className="text-gray-500" />
              <span>{t(locale, 'insertImage')}</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMediaType('video')}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              title={t(locale, 'insertVideo')}
            >
              <Video size={16} className="text-gray-500" />
              <span>{t(locale, 'insertVideo')}</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMediaType('audio')}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              title={t(locale, 'insertAudio')}
            >
              <Music size={16} className="text-gray-500" />
              <span>{t(locale, 'insertAudio')}</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMediaType('file')}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              title={t(locale, 'insertFile')}
            >
              <File size={16} className="text-gray-500" />
              <span>{t(locale, 'insertFile')}</span>
            </button>
          </div>
        </ToolbarPopup>

        {mediaType &&
          (mediaType === 'video' ||
            mediaType === 'audio' ||
            mediaType === 'file') && (
            <ToolbarPopup
              anchorRef={ref}
              open={mediaType !== null}
              onClose={() => setMediaType(null)}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
            >
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  {mediaType === 'video'
                    ? t(locale, 'insertVideo')
                    : mediaType === 'audio'
                      ? t(locale, 'insertAudio')
                      : t(locale, 'insertFile')}
                </p>
                <input
                  type="file"
                  accept={
                    mediaType === 'video'
                      ? 'video/*'
                      : mediaType === 'audio'
                        ? 'audio/*'
                        : '*/*'
                  }
                  onChange={(e) =>
                    handleFileUpload(e, mediaType as 'video' | 'audio' | 'file')
                  }
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {uploading && (
                  <p className="text-sm text-gray-500">
                    {t(locale, 'uploading')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setMediaType(null)}
                  disabled={uploading}
                  className="w-full rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(locale, 'cancel')}
                </button>
              </div>
            </ToolbarPopup>
          )}
      </div>

      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onConfirm={handleImageConfirm}
        cursorPosition={imageCursor}
      />
    </>
  );
}
