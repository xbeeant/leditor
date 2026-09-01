import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes } from 'lexical';
import { useCallback, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { insertBlockAfter, insertBlockWithParagraphAfter } from '../commands';
import { useEmbedConfig } from '../embed';
import { t } from '../i18n';
import { uploadAttachment } from '../media';
import { EquationModal } from '../modals';
import { ImageModal } from '../modals';
import { $createEquationNode } from '../nodes';
import { $createFileNode } from '../nodes';
import { $createImageNode } from '../nodes';
import { SlashCommandPlugin } from '../plugins';

/**
 * 承载 slash 命令：管理公式/图片/文件模态框状态，并把 SlashCommandPlugin
 * 触发的插入动作接入编辑器。拥有独立的 editor 上下文访问权限。
 */
export function SlashCommandsHost() {
  const [editor] = useLexicalComposerContext();
  const embedConfig = useEmbedConfig();
  const locale = useLocale();

  const [equationOpen, setEquationOpen] = useState(false);
  const [equationInline, setEquationInline] = useState(false);
  const [equationCursor, setEquationCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [imageCursor, setImageCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [fileUploadOpen, setFileUploadOpen] = useState(false);
  const [fileUploadCursor, setFileUploadCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Slash-command 会移除斜杠文本、重置选区，导致光标位置丢失；
  // 保存触发时刻的浏览器选区范围，供模态框定位使用。
  const savedRangeRef = useRef<Range | null>(null);

  const captureCursor = useCallback((): { x: number; y: number } | null => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.bottom };
    }
    const editorRoot = editor.getRootElement();
    if (editorRoot) {
      const r = editorRoot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 60 };
    }
    return null;
  }, [editor]);

  const openEquation = useCallback(
    (inline: boolean) => {
      setEquationCursor(captureCursor());
      setEquationInline(inline);
      setEquationOpen(true);
    },
    [captureCursor],
  );

  const openImage = useCallback(() => {
    setImageCursor(captureCursor());
    setImageOpen(true);
  }, [captureCursor]);

  const openFileUpload = useCallback(() => {
    setFileUploadCursor(captureCursor());
    setFileUploadOpen(true);
  }, [captureCursor]);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const attachment = embedConfig?.attachment;
      if (!attachment?.action) {
        alert(t(locale, 'uploadNotConfigured'));
        return;
      }

      setFileUploading(true);
      uploadAttachment(file, attachment)
        .then((result) => {
          insertBlockAfter(editor, () =>
            $createFileNode({
              url: result.url,
              filename: result.filename,
              size: result.size,
            }),
          );
          setFileUploadOpen(false);
        })
        .catch(() => {
          alert(t(locale, 'uploadFailed'));
        })
        .finally(() => {
          setFileUploading(false);
          // 重置 file input 以便重新选择同一文件
          const input = event.target as HTMLInputElement;
          input.value = '';
        });
    },
    [embedConfig, editor, locale],
  );

  const handleEquationConfirm = useCallback(
    (equation: string) => {
      if (equationInline) {
        // 行内公式：插入到当前光标（slash 移除后）位置，与周围文本同行
        editor.update(() => {
          $insertNodes([$createEquationNode(equation, true)]);
        });
        editor.focus();
      } else {
        // 块级公式：作为独立块插入当前行下方，并在其后追加正文段落
        insertBlockWithParagraphAfter(editor, () =>
          $createEquationNode(equation, false),
        );
      }
    },
    [editor, equationInline],
  );

  const handleImageConfirm = useCallback(
    (src: string, altText: string) => {
      insertBlockAfter(editor, () => $createImageNode({ src, altText }));
    },
    [editor],
  );

  return (
    <>
      <SlashCommandPlugin
        onOpenEquation={openEquation}
        onOpenImage={openImage}
        onOpenFileUpload={openFileUpload}
      />
      <EquationModal
        open={equationOpen}
        onClose={() => setEquationOpen(false)}
        onConfirm={handleEquationConfirm}
        title={
          equationInline
            ? t(locale, 'equationModalInlineTitle')
            : t(locale, 'equationModalTitle')
        }
        cursorPosition={equationCursor}
      />
      <ImageModal
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onConfirm={handleImageConfirm}
        cursorPosition={imageCursor}
      />
      {fileUploadOpen && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center"
          style={{
            top: fileUploadCursor?.y ? `${fileUploadCursor.y}px` : '50%',
            left: fileUploadCursor?.x ? `${fileUploadCursor.x}px` : '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setFileUploadOpen(false)}
          />
          <div className="relative z-10 rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-medium text-gray-700">
              {t(locale, 'uploadFile')}
            </h3>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={fileUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-medium hover:file:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {fileUploading && (
              <p className="mt-2 text-sm text-gray-500">
                {t(locale, 'uploading')}
              </p>
            )}
            <button
              type="button"
              onClick={() => setFileUploadOpen(false)}
              disabled={fileUploading}
              className="mt-4 rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(locale, 'cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
