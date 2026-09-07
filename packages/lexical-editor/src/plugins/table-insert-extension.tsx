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
  defineExtension,
} from 'lexical';

/**
 * 表格插入扩展：注册 `INSERT_TABLE_COMMAND`，
 * 使工具栏的「插入 → 表格」功能正常工作。
 */
export const TableInsertExtension = defineExtension({
  name: '@leditor/table-insert',
  register(editor) {
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
  },
});
