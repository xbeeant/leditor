import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
} from 'lexical';
import {
  INSERT_EQUATION_COMMAND,
  type InsertEquationPayload,
  insertBlockWithParagraphAfter,
} from '../commands';
import { $createEquationNode, EquationNode } from '../nodes';

/**
 * Registers the `INSERT_EQUATION_COMMAND` so equations can be inserted
 * from anywhere with editor access.
 */
export const InsertEquationExtension = defineExtension({
  name: '@leditor/insert-equation',
  register(editor) {
    if (!editor.hasNodes([EquationNode])) {
      throw new Error('InsertEquationExtension: EquationNode not registered');
    }
    return editor.registerCommand<InsertEquationPayload>(
      INSERT_EQUATION_COMMAND,
      (payload) => {
        if (payload.inline) {
          $insertNodes([$createEquationNode(payload.equation, true)]);
          return true;
        }
        // 块级公式：插入后追加一个正文段落，光标落入新段落以便继续输入
        insertBlockWithParagraphAfter(editor, () =>
          $createEquationNode(payload.equation, false),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
