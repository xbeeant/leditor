import { COMMAND_PRIORITY_EDITOR, defineExtension } from 'lexical';
import {
  INSERT_FILE_COMMAND,
  type InsertFilePayload,
  insertBlockWithParagraphAfter,
} from '../commands';
import { $createFileNode, FileNode } from '../nodes';

/**
 * 注册 `INSERT_FILE_COMMAND`,在光标后插入文件节点（附件），并追加正文段落。
 * 文件节点以内联附件卡片形式渲染，支持下载和删除操作。
 */
export const InsertFileExtension = defineExtension({
  name: '@leditor/insert-file',
  register(editor) {
    if (!editor.hasNodes([FileNode])) {
      throw new Error('InsertFileExtension: FileNode not registered');
    }
    return editor.registerCommand<InsertFilePayload>(
      INSERT_FILE_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createFileNode({
            url: payload.url,
            filename: payload.filename,
            size: payload.size,
          }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
