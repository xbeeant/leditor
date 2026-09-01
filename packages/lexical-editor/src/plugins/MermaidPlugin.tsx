import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  createCommand,
} from 'lexical';
import { useEffect } from 'react';
import { $createMermaidNode, MermaidNode } from '../nodes';

export const INSERT_MERMAID_COMMAND: LexicalCommand<string> = createCommand(
  'INSERT_MERMAID_COMMAND',
);

/**
 * Mermaid 插件：注册 `INSERT_MERMAID_COMMAND`，在光标处插入 Mermaid 节点。
 */
export function MermaidPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([MermaidNode])) {
      throw new Error('MermaidPlugin: MermaidNode 未在 Composer 中注册');
    }

    return editor.registerCommand(
      INSERT_MERMAID_COMMAND,
      (initialCode: string) => {
        const mermaidNode = $createMermaidNode(initialCode);
        $insertNodes([mermaidNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
