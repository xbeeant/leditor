import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTableNodeWithDimensions,
  INSERT_TABLE_COMMAND,
  type InsertTableCommandPayload,
} from '@lexical/table';
import {
  $caretFromPoint,
  $getSelection,
  $insertNodeToNearestRootAtCaret,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
} from 'lexical';
import { useEffect } from 'react';

/** Registers `INSERT_TABLE_COMMAND` so the toolbar's "Insert → Table" works. */
export function TablePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<InsertTableCommandPayload>(
      INSERT_TABLE_COMMAND,
      (payload) => {
        const { columns, rows, includeHeaders } = payload;
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const tableNode = $createTableNodeWithDimensions(
              Number(rows),
              Number(columns),
              includeHeaders,
            );
            const caret = $caretFromPoint(selection.anchor, 'next');
            $insertNodeToNearestRootAtCaret(tableNode, caret);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  return null;
}
