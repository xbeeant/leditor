import {
  $wrapSelectionInMarkNode,
  $isMarkNode,
  $unwrapMarkNode,
  MarkExtension,
  type MarkNode,
} from '@lexical/mark';
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
  type LexicalNode,
} from 'lexical';
import { UNWRAP_MARK_COMMAND, WRAP_SELECTION_IN_MARK_COMMAND } from './commentCommands';

function collectMarks(node: LexicalNode, threadID: string, marks: MarkNode[]): void {
  if ($isMarkNode(node) && node.hasID(threadID)) {
    marks.push(node);
  }
  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      collectMarks(child, threadID, marks);
    }
  }
}

/**
 * Editor extension powering the comment feature. It registers `MarkNode`
 * (via `MarkExtension`) and handles wrapping the current selection in a mark
 * and unwrapping marks when a comment thread is emptied.
 */
export const CommentExtension = defineExtension({
  name: '@leditor/comment',
  dependencies: [MarkExtension],

  register(editor) {
    const unregisterWrap = editor.registerCommand(
      WRAP_SELECTION_IN_MARK_COMMAND,
      (threadID) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          return false;
        }
        $wrapSelectionInMarkNode(selection, selection.isBackward(), threadID);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterUnwrap = editor.registerCommand(
      UNWRAP_MARK_COMMAND,
      (threadID) => {
        const marks: MarkNode[] = [];
        collectMarks($getRoot(), threadID, marks);
        marks.forEach((mark) => {
          if (mark.getIDs().length <= 1) {
            $unwrapMarkNode(mark);
          } else {
            mark.deleteID(threadID);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unregisterWrap();
      unregisterUnwrap();
    };
  },
});
