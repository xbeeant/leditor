import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  createCommand,
  defineExtension,
} from 'lexical';
import { type CalloutIcon, CalloutNode } from '../nodes';

export interface InsertCalloutPayload {
  icon?: CalloutIcon;
}

export const INSERT_CALLOUT_COMMAND: LexicalCommand<InsertCalloutPayload> =
  createCommand('INSERT_CALLOUT_COMMAND');

/**
 * Callout 提示块扩展：注册 `INSERT_CALLOUT_COMMAND`，
 * 在光标处插入带空段落的 Callout 提示块。
 */
export const CalloutExtension = defineExtension({
  name: '@leditor/callout',
  register(editor) {
    if (!editor.hasNodes([CalloutNode])) {
      throw new Error('CalloutExtension: CalloutNode 未在编辑器中注册');
    }

    return editor.registerCommand(
      INSERT_CALLOUT_COMMAND,
      (payload) => {
        const node = new CalloutNode(payload?.icon ?? 'note');
        node.append($createParagraphNode());
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $insertNodes([node]);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
