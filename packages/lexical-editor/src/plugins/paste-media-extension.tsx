import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ReactExtension } from '@lexical/react/ReactExtension';
import {
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type PasteCommandType,
  configExtension,
  defineExtension,
} from 'lexical';
import { useEffect } from 'react';
import { INSERT_AUDIO_COMMAND, INSERT_VIDEO_COMMAND } from '../commands';
import { useEditorConfig } from '../context';
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
function PasteMediaPluginInner(): null {
  const [editor] = useLexicalComposerContext();
  const editorConfig = useEditorConfig();

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
        for (const item of mediaItems) {
          const file = item.getAsFile();
          if (!file) continue;
          const kind = getKind(item.type);
          if (!kind || kind === 'image') continue;

          const insert = (src: string) => {
            if (kind === 'video') {
              editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src });
            } else if (kind === 'audio') {
              editor.dispatchCommand(INSERT_AUDIO_COMMAND, { src });
            }
          };

          const attachment = editorConfig?.embed?.attachment;
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
        }
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, editorConfig]);

  return null;
}

/** 粘贴媒体扩展：粘贴视频/音频文件时自动上传并插入编辑器。 */
export const PasteMediaExtension = defineExtension({
  name: '@leditor/paste-media',
  dependencies: [
    configExtension(ReactExtension, {
      decorators: [<PasteMediaPluginInner key="paste-media" />],
    }),
  ],
});
