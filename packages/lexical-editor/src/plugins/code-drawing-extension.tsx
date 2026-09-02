import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  createCommand,
  defineExtension,
} from 'lexical';
import { $createCodeDrawingNode, CodeDrawingNode } from '../nodes';

export const INSERT_CODE_DRAWING_COMMAND: LexicalCommand<void> = createCommand(
  'INSERT_CODE_DRAWING_COMMAND',
);

/**
 * 代码绘图扩展：注册插入命令，将代码绘图节点包裹进段落后插入。
 */
export const CodeDrawingExtension = defineExtension({
  name: '@leditor/code-drawing',
  register(editor) {
    if (!editor.hasNodes([CodeDrawingNode])) {
      throw new Error('CodeDrawingExtension: CodeDrawingNode 未在编辑器中注册');
    }

    return editor.registerCommand(
      INSERT_CODE_DRAWING_COMMAND,
      () => {
        const node = $createCodeDrawingNode('', 'mermaid', 'both');
        $insertNodes([node]);
        if ($isRootOrShadowRoot(node.getParentOrThrow())) {
          $wrapNodeInElement(node, $createParagraphNode).selectEnd();
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
