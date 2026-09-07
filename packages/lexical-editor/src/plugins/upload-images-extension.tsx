import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { isMimeType, mediaFileReader } from '@lexical/utils';
import {
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type PasteCommandType,
  configExtension,
  defineExtension,
} from 'lexical';
import { useEffect } from 'react';
import { INSERT_IMAGE_COMMAND } from '../commands';
import { useEditorConfig } from '../context';
import { uploadAttachment } from '../media';

/** 可接受的图片 MIME 类型前缀 */
const IMAGE_TYPES = ['image/'];

/**
 * 拖拽 / 粘贴图片上传。拦截从操作系统拖入或从剪贴板粘贴的图片文件，
 * 通过 `embed.attachment.action` 上传到服务器，并用返回的 URL 插入编辑器。
 */
function UploadImagesPluginInner(): null {
  const [editor] = useLexicalComposerContext();
  const editorConfig = useEditorConfig();

  useEffect(() => {
    const uploadImage = (file: File, altText: string): void => {
      const attachment = editorConfig?.embed?.attachment;
      if (attachment?.action) {
        uploadAttachment(file, attachment)
          .then((result) => {
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              altText,
              src: result.url,
            });
          })
          .catch(() => {
            // 上传失败时回退到 data URL，保持编辑器可用
            const reader = new FileReader();
            reader.onload = () => {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                altText,
                src: reader.result as string,
              });
            };
            reader.readAsDataURL(file);
          });
      } else {
        // 未配置 attachment 时回退到 data URL
        const reader = new FileReader();
        reader.onload = () => {
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
            altText,
            src: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      }
    };

    // 浏览器把图片文件拖入编辑器：自动定位到拖放位置并插入
    const unregisterDragDrop = editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        (async () => {
          const filesResult = await mediaFileReader(files, IMAGE_TYPES);
          for (const { file } of filesResult) {
            if (isMimeType(file, IMAGE_TYPES)) {
              uploadImage(file, file.name || 'pasted-image');
            }
          }
        })();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    // 从剪贴板粘贴图片文件
    const unregisterPaste = editor.registerCommand<PasteCommandType>(
      PASTE_COMMAND,
      (event: PasteCommandType) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const items = Array.from(clipboardData.items);
        const imageFiles = items
          .filter(
            (item) => item.kind === 'file' && item.type.startsWith('image/'),
          )
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null);

        if (imageFiles.length === 0) return false;

        event.preventDefault();
        (async () => {
          for (const file of imageFiles) {
            uploadImage(file, file.name || 'pasted-image');
          }
        })();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregisterDragDrop();
      unregisterPaste();
    };
  }, [editor, editorConfig]);

  return null;
}

/** 图片上传扩展：拖拽/粘贴图片时自动上传并插入编辑器。 */
export const UploadImagesExtension = defineExtension({
  name: '@leditor/upload-images',
  dependencies: [
    configExtension(ReactExtension, {
      decorators: [<UploadImagesPluginInner key="upload-images" />],
    }),
  ],
});
