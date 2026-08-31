import { $wrapNodeInElement } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from 'lexical';
import { useEffect } from 'react';
import {
  $createCodeDrawingNode,
  CodeDrawingNode,
} from './CodeDrawingNode';

export const INSERT_CODE_DRAWING_COMMAND: LexicalCommand<void> = createCommand(
  'INSERT_CODE_DRAWING_COMMAND',
);

/**
 * 代码绘图插件：注册插入命令，将代码绘图节点包裹进段落后插入。
 */
export function CodeDrawingPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([CodeDrawingNode])) {
      throw new Error('CodeDrawingPlugin: CodeDrawingNode 未注册');
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
  }, [editor]);

  return null;
}
