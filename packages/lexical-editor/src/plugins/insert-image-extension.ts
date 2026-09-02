import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
} from 'lexical';
import { INSERT_IMAGE_COMMAND, type InsertImagePayload } from '../commands';
import { $createImageNode, ImageNode } from '../nodes';

/**
 * Replaces the inline `InsertImagePlugin`. Registers the
 * `INSERT_IMAGE_COMMAND` so images can be inserted from anywhere with editor
 * access.
 */
export const InsertImageExtension = defineExtension({
  name: '@leditor/insert-image',
  register(editor) {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('InsertImageExtension: ImageNode not registered');
    }
    return editor.registerCommand<InsertImagePayload>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
