import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type PasteCommandType,
} from 'lexical';
import { useEffect } from 'react';
import { INSERT_AUDIO_COMMAND, INSERT_VIDEO_COMMAND } from '../commands';
import { useEmbedConfig } from '../embed';
import { uploadAttachment } from '../media';

type MediaKind = 'image' | 'video' | 'audio';

function getKind(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

/**
 * 粘贴媒体文件（视频 / 音频）时自动上传并插入编辑器。
 *
 * 若配置了 `embed.attachment.action`，则上传到后端并用返回的地址插入；
 * 否则对视频 / 音频使用 object URL 做本地预览。
 */
export function PasteMediaPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const embedConfig = useEmbedConfig();

  useEffect(() => {
    return editor.registerCommand<PasteCommandType>(
      PASTE_COMMAND,
      (event: PasteCommandType) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const items = Array.from(clipboardData.items);
        const mediaItems = items.filter(
          (item) => item.kind === 'file' && getKind(item.type) !== null,
        );

        if (mediaItems.length === 0) return false;

        // 有图片时走 UploadImagesPlugin 处理，本插件只处理视频/音频
        const hasImage = mediaItems.some(
          (item) => getKind(item.type) === 'image',
        );
        if (hasImage) return false;

        event.preventDefault();
        mediaItems.forEach((item) => {
          const file = item.getAsFile();
          if (!file) return;
          const kind = getKind(item.type);
          if (!kind || kind === 'image') return;

          const insert = (src: string) => {
            if (kind === 'video') {
              editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src });
            } else if (kind === 'audio') {
              editor.dispatchCommand(INSERT_AUDIO_COMMAND, { src });
            }
          };

          const attachment = embedConfig?.attachment;
          if (attachment?.action) {
            uploadAttachment(file, attachment)
              .then((result) => insert(result.url))
              .catch(() => {
                // 上传失败时回退到 object URL 本地预览
                insert(URL.createObjectURL(file));
              });
          } else {
            insert(URL.createObjectURL(file));
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, embedConfig]);

  return null;
}
