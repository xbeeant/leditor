import { COMMAND_PRIORITY_EDITOR, defineExtension } from 'lexical';
import {
  INSERT_AUDIO_COMMAND,
  type InsertAudioPayload,
  insertBlockWithParagraphAfter,
} from '../commands';
import { $createAudioNode, AudioNode } from '../nodes';

/**
 * 注册 `INSERT_AUDIO_COMMAND`,在光标后插入音频节点并追加正文段落。
 */
export const InsertAudioExtension = defineExtension({
  name: '@leditor/insert-audio',
  register(editor) {
    if (!editor.hasNodes([AudioNode])) {
      throw new Error('InsertAudioExtension: AudioNode not registered');
    }
    return editor.registerCommand<InsertAudioPayload>(
      INSERT_AUDIO_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createAudioNode({ src: payload.src }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
