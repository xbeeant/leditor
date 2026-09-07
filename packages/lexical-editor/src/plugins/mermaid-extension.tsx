import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  createCommand,
  defineExtension,
} from 'lexical';
import { $createMermaidNode, MermaidNode } from '../nodes';

export const INSERT_MERMAID_COMMAND: LexicalCommand<string> = createCommand(
  'INSERT_MERMAID_COMMAND',
);

/**
 * Mermaid 扩展：注册 `INSERT_MERMAID_COMMAND`，在光标处插入 Mermaid 节点。
 */
export const MermaidExtension = defineExtension({
  name: '@leditor/mermaid',
  register(editor) {
    if (!editor.hasNodes([MermaidNode])) {
      throw new Error('MermaidExtension: MermaidNode 未在编辑器中注册');
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
  },
});
