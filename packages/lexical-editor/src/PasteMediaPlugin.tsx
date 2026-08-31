import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type PasteCommandType,
} from 'lexical';
import { useEffect } from 'react';
import {
  INSERT_AUDIO_COMMAND,
  INSERT_VIDEO_COMMAND,
} from './commands';
import { useMediaConfig } from './media/MediaConfigContext';
import { uploadFile } from './media/upload';
import type { MediaConfig } from './media/config';

type MediaKind = 'image' | 'video' | 'audio';

function getKind(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

/**
 * 粘贴媒体文件（图片 / 视频 / 音频）时自动上传并插入编辑器。
 *
 * 若配置了 `uploadUrl`，则上传到后端并用返回的地址插入；否则对图片使用
 * data URL（自包含渲染），对视频 / 音频使用 object URL 做本地预览。
 *
 * 注意：图片的粘贴与拖拽已由 `UploadImagesPlugin` 处理，为避免命令冲突，
 * 本插件只聚焦图片之外的视频 / 音频（以及当配置了 uploadUrl 时统一处理）。
 */
export function PasteMediaPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const mediaConfig = useMediaConfig();

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

        // 图片走 data URL 逻辑，尽量避免与 UploadImagesPlugin 重复处理。
        // 为避免重复插入，仅当剪贴板中没有图片时才由本插件接管全部媒体。
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

          const objectURL = URL.createObjectURL(file);

          const insert = (src: string) => {
            if (kind === 'video') {
              editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src });
            } else if (kind === 'audio') {
              editor.dispatchCommand(INSERT_AUDIO_COMMAND, { src });
            }
          };

          const config: MediaConfig | undefined = mediaConfig;
          if (config?.uploadUrl) {
            uploadFile(file, config)
              .then((result) => insert(result.url))
              .catch(() => insert(objectURL));
          } else {
            insert(objectURL);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, mediaConfig]);

  return null;
}
