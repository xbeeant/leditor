import { INSERT_VIDEO_COMMAND, type InsertVideoPayload, insertBlockWithParagraphAfter } from '../commands';
import { VideoNode, $createVideoNode } from '../nodes';
import { COMMAND_PRIORITY_EDITOR, defineExtension } from 'lexical';

/**
 * 注册 `INSERT_VIDEO_COMMAND`,在光标后插入视频节点并追加正文段落,
 * 使光标能继续输入。视频为块级、无自带光标。
 */
export const InsertVideoExtension = defineExtension({
  name: '@leditor/insert-video',
  register(editor) {
    if (!editor.hasNodes([VideoNode])) {
      throw new Error('InsertVideoExtension: VideoNode not registered');
    }
    return editor.registerCommand<InsertVideoPayload>(
      INSERT_VIDEO_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createVideoNode({
            src: payload.src,
            width: payload.width,
            height: payload.height,
          }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
