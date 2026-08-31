import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from 'lexical';
import { useEffect } from 'react';
import { CalloutNode, type CalloutIcon } from './CalloutNode';

export interface InsertCalloutPayload {
  icon?: CalloutIcon;
}

export const INSERT_CALLOUT_COMMAND: LexicalCommand<InsertCalloutPayload> =
  createCommand('INSERT_CALLOUT_COMMAND');

/**
 * Callout 提示块插件：注册 `INSERT_CALLOUT_COMMAND`，
 * 在光标处插入带空段落的 Callout 提示块。
 */
export function CalloutPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([CalloutNode])) {
      throw new Error('CalloutPlugin: CalloutNode 未在 Composer 中注册');
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
  }, [editor]);

  return null;
}
