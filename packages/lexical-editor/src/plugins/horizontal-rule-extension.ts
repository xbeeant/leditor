import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
} from 'lexical';

/**
 * Replaces `@lexical/react/LexicalHorizontalRulePlugin`. Uses the React
 * `HorizontalRuleNode` (so it renders with selection UI) while keeping the
 * editor configuration fully extension-based.
 */
export const HorizontalRuleExtension = defineExtension({
  name: '@leditor/horizontal-rule',
  register(editor) {
    return editor.registerCommand(
      INSERT_HORIZONTAL_RULE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const focusNode = selection.focus.getNode();
        if (focusNode !== null) {
          $insertNodeToNearestRoot($createHorizontalRuleNode());
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
