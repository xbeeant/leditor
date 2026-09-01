import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTableSelectionFrom,
  $findCellNode,
  $findTableNode,
  $isTableCellNode,
  type TableCellNode,
  type TableNode,
} from '@lexical/table';
import {
  $getNearestNodeFromDOMNode,
  $setSelection,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

/**
 * 修复跨单元格拖选：@lexical/table 官方行为是当鼠标拖选出表格边界时
 * （$fixRangeSelectionForSelectedTable 的 shouldMoveAnchor 分支），
 * 会选中整个表格，而不是仅选表格内实际滑过的矩形区域。
 *
 * 该插件在 document 捕获阶段监听 mouseup（早于官方注册在 window 上的
 * pointerup），用 DOM Selection 的原生选区抢先建立 TableSelection，
 * 把焦点夹取回表格边界单元格，从而只选中滑过的部分。
 */
function getTableCellAtPoint(
  node: Node | null,
  editor: LexicalEditor,
): { cell: TableCellNode | null; table: TableNode | null } {
  if (node === null) {
    return { cell: null, table: null };
  }
  let cell: TableCellNode | null = null;
  let table: TableNode | null = null;
  editor.getEditorState().read(
    () => {
      const lexicalNode = $getNearestNodeFromDOMNode(node);
      if (lexicalNode === null) {
        return;
      }
      cell = $findCellNode(lexicalNode);
      if (cell === null) {
        return;
      }
      table = $findTableNode(cell);
    },
    { editor },
  );
  return { cell, table };
}

export function TableDragSelectFix(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const establishSelection = (
      table: TableNode,
      anchor: TableCellNode,
      target: TableCellNode,
    ) => {
      editor.update(() => {
        const selection = $createTableSelectionFrom(table, anchor, target);
        $setSelection(selection);
      });
      editor.dispatchCommand(SELECTION_CHANGE_COMMAND);
    };

    const findClosestCellToPoint = (
      table: TableNode,
      clientX: number,
      clientY: number,
    ): TableCellNode | null => {
      const domElement = editor.getElementByKey(table.getKey());
      const tableElement =
        domElement instanceof HTMLTableElement
          ? domElement
          : domElement?.querySelector('table');
      if (tableElement === null || tableElement === undefined) {
        return null;
      }
      let closest: HTMLTableCellElement | null = null;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const cell of Array.from(
        tableElement.querySelectorAll<HTMLTableCellElement>('td, th'),
      )) {
        const rect = cell.getBoundingClientRect();
        const cx = Math.max(rect.left, Math.min(clientX, rect.right));
        const cy = Math.max(rect.top, Math.min(clientY, rect.bottom));
        const distance = (clientX - cx) ** 2 + (clientY - cy) ** 2;
        if (distance < minDistance) {
          minDistance = distance;
          closest = cell;
        }
      }
      if (closest === null) {
        return null;
      }
      let cellNode: TableCellNode | null = null;
      editor.getEditorState().read(
        () => {
          const lexicalNode = $getNearestNodeFromDOMNode(closest);
          if (lexicalNode !== null && $isTableCellNode(lexicalNode)) {
            cellNode = lexicalNode;
          }
        },
        { editor },
      );
      return cellNode;
    };

    const handleMouseUp = (event: MouseEvent) => {
      const domSelection = window.getSelection();
      if (domSelection === null || domSelection.isCollapsed) {
        return;
      }
      const rootElement = editor.getRootElement();
      if (rootElement === null) {
        return;
      }
      const anchorNode = domSelection.anchorNode;
      const focusNode = domSelection.focusNode;
      if (!(anchorNode instanceof Node) || !(focusNode instanceof Node)) {
        return;
      }
      if (
        !rootElement.contains(anchorNode) ||
        !rootElement.contains(focusNode)
      ) {
        return;
      }

      const anchor = getTableCellAtPoint(anchorNode, editor);
      const focus = getTableCellAtPoint(focusNode, editor);

      // 焦点被拖出表格：夹取回表格内距离鼠标最近的单元格。
      if (
        anchor.cell !== null &&
        anchor.table !== null &&
        focus.cell === null
      ) {
        const target = findClosestCellToPoint(
          anchor.table,
          event.clientX,
          event.clientY,
        );
        if (target !== null && !anchor.cell.is(target)) {
          establishSelection(anchor.table, anchor.cell, target);
        }
        return;
      }

      // 同一表格内跨格拖选：显式建立矩形选择，防止后续被扩展为整表。
      if (
        anchor.cell !== null &&
        anchor.table !== null &&
        focus.cell !== null &&
        focus.table !== null &&
        anchor.table.is(focus.table) &&
        !anchor.cell.is(focus.cell)
      ) {
        establishSelection(anchor.table, anchor.cell, focus.cell);
      }
    };

    document.addEventListener('mouseup', handleMouseUp, true);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [editor]);

  return null;
}
