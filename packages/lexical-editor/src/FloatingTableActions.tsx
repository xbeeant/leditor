import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import {
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isSimpleTable,
  $isTableCellNode,
  $isTableNode,
  $moveTableColumn,
} from '@lexical/table';
import { $getNearestNodeFromDOMNode, $getNodeByKey } from 'lexical';
import { GripVertical, Plus } from 'lucide-react';
import {
  type JSX,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { t } from './i18n';
import { useLocale } from './LocaleContext';

const BUTTON_OVERHANG = 9;
const INDICATOR_WIDTH = 2;

type DropIndicatorState = {
  left: number;
  top: number;
  height: number;
};

/** 根据鼠标 X 坐标计算列边界索引（0..列数）。 */
function getBoundaryIndexFromClientX(
  headerRow: HTMLTableRowElement,
  clientX: number,
): number {
  const cells = Array.from(headerRow.cells);
  for (const [i, cell] of cells.entries()) {
    const rect = cell.getBoundingClientRect();
    if (clientX < rect.left) {
      return i;
    }
    if (clientX < rect.right) {
      return i + (clientX > rect.left + rect.width / 2 ? 1 : 0);
    }
  }
  return cells.length;
}

function getDropIndicatorState(
  headerRow: HTMLTableRowElement,
  tableRect: DOMRect,
  boundaryIndex: number,
): DropIndicatorState | null {
  const cells = Array.from(headerRow.cells);
  if (cells.length === 0) {
    return null;
  }
  const clampedIndex = Math.max(0, Math.min(boundaryIndex, cells.length));
  const isRightEdge = clampedIndex === cells.length;
  const boundaryCell =
    clampedIndex === 0
      ? cells[0]
      : (cells[clampedIndex] ?? cells[cells.length - 1]);
  const rect = boundaryCell.getBoundingClientRect();
  return {
    left: isRightEdge ? rect.right : rect.left,
    top: tableRect.top,
    height: tableRect.height,
  };
}

function getTableCellFromTarget(
  target: EventTarget | null,
): HTMLTableCellElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLTableCellElement>('td, th')
    : null;
}

function FloatingTableActions(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const locale = useLocale();

  const hoveredTopCellRef = useRef<HTMLTableCellElement | null>(null);
  const hoveredLeftCellRef = useRef<HTMLTableCellElement | null>(null);
  const hoveredTableRef = useRef<HTMLTableElement | null>(null);
  const dragRef = useRef<{ tableKey: string; startIndex: number } | null>(null);
  const boundaryRef = useRef<number | null>(null);

  const isTopVisibleRef = useRef(false);
  const isLeftVisibleRef = useRef(false);
  const topPosRef = useRef<{ left: number; top: number } | null>(null);
  const leftPosRef = useRef<{ left: number; top: number } | null>(null);
  const canReorderRef = useRef(false);

  const [isTopVisible, setIsTopVisible] = useState(false);
  const [isLeftVisible, setIsLeftVisible] = useState(false);
  const [topPos, setTopPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [leftPos, setLeftPos] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [canReorder, setCanReorder] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(
    null,
  );

  useEffect(() => {
    const hideActions = () => {
      hoveredTopCellRef.current = null;
      hoveredLeftCellRef.current = null;
      hoveredTableRef.current = null;
      isTopVisibleRef.current = false;
      isLeftVisibleRef.current = false;
      topPosRef.current = null;
      leftPosRef.current = null;
      canReorderRef.current = false;
      setIsTopVisible(false);
      setIsLeftVisible(false);
      setTopPos(null);
      setLeftPos(null);
      setCanReorder(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      // 拖拽进行中不干扰，放置指示线由 pointermove 驱动。
      if (dragRef.current) {
        return;
      }
      // 鼠标悬停在操作栏自身时保持当前状态，避免清空已定位的按钮。
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('[data-table-action-bar]')
      ) {
        return;
      }

      const hoveredCell = getTableCellFromTarget(event.target);
      const tableElement =
        hoveredCell?.closest<HTMLTableElement>('table') ?? null;
      const root = editor.getRootElement();

      if (
        !tableElement ||
        !hoveredCell ||
        !root ||
        !root.contains(tableElement)
      ) {
        // 鼠标不在单元格上：只要仍在已显示操作栏的表格周边一定范围内，
        // 就保持按钮显示，留出把鼠标移向按钮的余量。
        const activeTable = hoveredTableRef.current;
        if (activeTable && root?.contains(activeTable)) {
          const rect = activeTable.getBoundingClientRect();
          const withinReach =
            event.clientX >= rect.left - 30 &&
            event.clientX <= rect.right + 30 &&
            event.clientY >= rect.top - 30 &&
            event.clientY <= rect.bottom + 30;
          if (withinReach) {
            return;
          }
        }
        if (isTopVisibleRef.current || isLeftVisibleRef.current) {
          hideActions();
        }
        return;
      }

      // 表格变化时刷新可拖拽状态（无合并单元格才允许重排）。
      if (hoveredTableRef.current !== tableElement) {
        hoveredTableRef.current = tableElement;
        const nextCanReorder = editor.getEditorState().read(
          () => {
            const tableNode = $getNearestNodeFromDOMNode(tableElement);
            return $isTableNode(tableNode) && $isSimpleTable(tableNode);
          },
          { editor },
        );
        canReorderRef.current = nextCanReorder;
        setCanReorder(nextCanReorder);
      }

      const rowIndex =
        hoveredCell.parentElement instanceof HTMLTableRowElement
          ? hoveredCell.parentElement.rowIndex
          : -1;
      const colIndex = hoveredCell.cellIndex ?? -1;

      // 顶部操作：悬停第一行时，在所在列中心上方显示。
      if (rowIndex === 0) {
        const rect = hoveredCell.getBoundingClientRect();
        hoveredTopCellRef.current = hoveredCell;
        const pos = {
          left: rect.left + rect.width / 2,
          top: rect.top - BUTTON_OVERHANG,
        };
        const changed =
          !isTopVisibleRef.current ||
          !topPosRef.current ||
          topPosRef.current.left !== pos.left ||
          topPosRef.current.top !== pos.top;
        if (changed) {
          topPosRef.current = pos;
          setTopPos(pos);
        }
        if (!isTopVisibleRef.current) {
          isTopVisibleRef.current = true;
          setIsTopVisible(true);
        }
      } else {
        hoveredTopCellRef.current = null;
        if (isTopVisibleRef.current) {
          isTopVisibleRef.current = false;
          topPosRef.current = null;
          setIsTopVisible(false);
          setTopPos(null);
        }
      }

      // 左侧操作：悬停第一列时，在所在行中心左侧显示。
      if (colIndex === 0) {
        const rect = hoveredCell.getBoundingClientRect();
        const tableRect = tableElement.getBoundingClientRect();
        hoveredLeftCellRef.current = hoveredCell;
        const pos = {
          left: tableRect.left - BUTTON_OVERHANG,
          top: rect.top + rect.height / 2,
        };
        const changed =
          !isLeftVisibleRef.current ||
          !leftPosRef.current ||
          leftPosRef.current.left !== pos.left ||
          leftPosRef.current.top !== pos.top;
        if (changed) {
          leftPosRef.current = pos;
          setLeftPos(pos);
        }
        if (!isLeftVisibleRef.current) {
          isLeftVisibleRef.current = true;
          setIsLeftVisible(true);
        }
      } else {
        hoveredLeftCellRef.current = null;
        if (isLeftVisibleRef.current) {
          isLeftVisibleRef.current = false;
          leftPosRef.current = null;
          setIsLeftVisible(false);
          setLeftPos(null);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [editor]);

  // 列拖拽：原生 pointer 事件代替 @atlaskit 拖拽。
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const el = editor.getElementByKey(drag.tableKey);
      if (!el) {
        return;
      }
      const tableElement =
        el instanceof HTMLTableElement ? el : el.querySelector('table');
      if (!tableElement) {
        return;
      }
      const headerRow = tableElement.rows[0];
      if (!headerRow) {
        return;
      }
      const boundaryIndex = getBoundaryIndexFromClientX(
        headerRow,
        event.clientX,
      );
      boundaryRef.current = boundaryIndex;
      setDropIndicator(
        getDropIndicatorState(
          headerRow,
          tableElement.getBoundingClientRect(),
          boundaryIndex,
        ),
      );
    };

    const finishDrag = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDropIndicator(null);
      if (!drag) {
        boundaryRef.current = null;
        return;
      }
      const boundaryIndex = boundaryRef.current ?? drag.startIndex;
      boundaryRef.current = null;
      const columnCount = editor.getEditorState().read(
        () => {
          const node = $getNodeByKey(drag.tableKey);
          return $isTableNode(node) ? node.getColumnCount() : 0;
        },
        { editor },
      );
      const clampedBoundary = Math.max(0, Math.min(boundaryIndex, columnCount));
      const startIndex = drag.startIndex;
      if (
        clampedBoundary === startIndex ||
        clampedBoundary === startIndex + 1 ||
        startIndex < 0 ||
        startIndex >= columnCount
      ) {
        return;
      }
      const finishIndex =
        clampedBoundary > startIndex ? clampedBoundary - 1 : clampedBoundary;
      editor.update(() => {
        const node = $getNodeByKey(drag.tableKey);
        if ($isTableNode(node)) {
          $moveTableColumn(node, startIndex, finishIndex);
        }
      });
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
    };
  }, [editor]);

  if (!isEditable) {
    return null;
  }

  const handleAddColumn = () => {
    const targetCell = hoveredTopCellRef.current;
    if (!targetCell) {
      return;
    }
    editor.update(() => {
      const cellNode = $getNearestNodeFromDOMNode(targetCell);
      if ($isTableCellNode(cellNode)) {
        cellNode.selectEnd();
        $insertTableColumnAtSelection();
      }
    });
  };

  const handleAddRow = () => {
    const targetCell = hoveredLeftCellRef.current;
    if (!targetCell) {
      return;
    }
    editor.update(() => {
      const cellNode = $getNearestNodeFromDOMNode(targetCell);
      if ($isTableCellNode(cellNode)) {
        cellNode.selectEnd();
        $insertTableRowAtSelection();
      }
    });
  };

  const handleDragStart = (event: ReactPointerEvent) => {
    event.preventDefault();
    const tableElement = hoveredTableRef.current;
    const topCell = hoveredTopCellRef.current;
    if (!tableElement || !topCell || !canReorderRef.current) {
      return;
    }
    const tableNode = editor
      .getEditorState()
      .read(() => $getNearestNodeFromDOMNode(tableElement), { editor });
    if (!$isTableNode(tableNode)) {
      return;
    }
    dragRef.current = {
      tableKey: tableNode.getKey(),
      startIndex: topCell.cellIndex ?? 0,
    };
    boundaryRef.current = topCell.cellIndex ?? 0;
  };

  const actionButtonClass =
    'flex h-5 w-5 items-center justify-center rounded text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <>
      {isTopVisible && topPos && (
        <div
          data-table-action-bar="top"
          className="fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-gray-200 bg-white/95 p-0.5 shadow-lg backdrop-blur"
          style={{ left: topPos.left, top: topPos.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            title={t(locale, 'insertColBefore')}
            className={actionButtonClass}
            onClick={handleAddColumn}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            title={canReorder ? t(locale, 'dragColumn') : t(locale, 'cannotDragColumn')}
            disabled={!canReorder}
            className={`${actionButtonClass} cursor-grab active:cursor-grabbing`}
            onPointerDown={handleDragStart}
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}
      {isLeftVisible && leftPos && (
        <div
          data-table-action-bar="left"
          className="fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-gray-200 bg-white/95 p-0.5 shadow-lg backdrop-blur"
          style={{ left: leftPos.left, top: leftPos.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            title={t(locale, 'insertRowBefore')}
            className={actionButtonClass}
            onClick={handleAddRow}
          >
            <Plus size={14} />
          </button>
        </div>
      )}
      {dropIndicator && (
        <div
          className="pointer-events-none fixed z-50 rounded-full"
          style={{
            left: dropIndicator.left - INDICATOR_WIDTH / 2,
            top: dropIndicator.top,
            width: INDICATOR_WIDTH,
            height: dropIndicator.height,
            backgroundColor: '#3b82f6',
            boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.35)',
          }}
        />
      )}
    </>
  );
}

export function FloatingTableActionsPlugin(): JSX.Element | null {
  const isEditable = useLexicalEditable();
  return isEditable
    ? createPortal(<FloatingTableActions />, document.body)
    : null;
}
