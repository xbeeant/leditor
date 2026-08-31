import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { DRAG_DROP_PASTE } from '@lexical/rich-text';
import { isMimeType, mediaFileReader } from '@lexical/utils';
import {
  COMMAND_PRIORITY_LOW,
  PASTE_COMMAND,
  type PasteCommandType,
} from 'lexical';
import { useEffect } from 'react';
import { INSERT_IMAGE_COMMAND } from './commands';

/** 可接受的图片 MIME 类型前缀 */
const IMAGE_TYPES = ['image/'];

/**
 * 拖拽 / 粘贴图片上传。拦截从操作系统拖入或从剪贴板粘贴的图片文件，
 * 用 `mediaFileReader` 将其读取为 data URL（本地渲染，无需后端），
 * 再派发 `INSERT_IMAGE_COMMAND` 插入到当前光标处。
 *
 * 参考 ca/lexical/packages/lib 的 `drag-drop-paste-plugin`（拖拽）与
 * `paste-attachment-plugin`（粘贴）；此处聚焦图片，且用 data URL 替代
 * 依赖后端的上传，使功能自包含。
 */
export function UploadImagesPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // 浏览器把图片文件拖入编辑器：自动定位到拖放位置并插入
    const unregisterDragDrop = editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        (async () => {
          const filesResult = await mediaFileReader(files, IMAGE_TYPES);
          for (const { file, result } of filesResult) {
            if (isMimeType(file, IMAGE_TYPES)) {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                altText: file.name || 'pasted-image',
                src: result,
              });
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
          const filesResult = await mediaFileReader(imageFiles, IMAGE_TYPES);
          for (const { file, result } of filesResult) {
            if (isMimeType(file, IMAGE_TYPES)) {
              editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
                altText: file.name || 'pasted-image',
                src: result,
              });
            }
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
  }, [editor]);

  return null;
}
