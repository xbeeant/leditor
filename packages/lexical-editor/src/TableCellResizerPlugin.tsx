import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import {
  $computeTableMapSkipCellCheck,
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
  type TableDOMCell,
  getDOMCellFromTarget,
  getTableElement,
} from '@lexical/table';
import { calculateZoomLevel } from '@lexical/utils';
import {
  $getNearestNodeFromDOMNode,
  type LexicalEditor,
  isHTMLElement,
} from 'lexical';
import {
  type PointerEventHandler,
  type ReactPortal,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const MIN_COLUMN_WIDTH = 20;
/** 垂直拖拽手柄的横向占用宽度（px） */
const HANDLE_WIDTH = 12;

/**
 * 表格列宽拖拽调调整。hover 到表格单元格时，在其右缘显示一个竖向拖拽手柄，
 * 按住拖动即可修改该列的宽度。
 *
 * 实现沿用官方 Lexical 的 `TableNode#getColWidths/setColWidths` 持久化模型
 * （`<colgroup>` 会随 `colWidths` 自动渲染与序列化），因此无需自定义表节点。
 * 参考 ca/lexical/packages/lib 的 `table-cell-resizer`，但聚焦「列宽」场景，
 * 去掉行高调整与部分手感细节，逻辑更精简。
 */
function TableCellResizer({ editor }: { editor: LexicalEditor }) {
  // 当前 hover/选中表格单元格对应的 DOM 元素
  const activeCellElemRef = useRef<HTMLElement | null>(null);
  const tableRectRef = useRef<DOMRect | null>(null);
  // 拖拽起点（客户端坐标）与当前坐标
  const dragStartXRef = useRef<{
    x: number;
    col: number;
    shouldSeed: boolean;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [activeCell, setActiveCell] = useState<TableDOMCell | null>(null);

  const resetState = useCallback(() => {
    activeCellElemRef.current = null;
    tableRectRef.current = null;
    dragStartXRef.current = null;
    setDragOffset(null);
    setActiveCell(null);
  }, []);

  // hover 检测：在编辑器根元素上监听 pointer move / down
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      if (!isHTMLElement(target)) return;
      // 拖拽中不重复检测 hover（由手柄的 pointer 事件接管）
      if (dragStartXRef.current) return;

      const cell = getDOMCellFromTarget(target);
      if (cell) {
        if (activeCellElemRef.current !== cell.elem) {
          editor.getEditorState().read(
            () => {
              const cellNode = $getNearestNodeFromDOMNode(cell.elem);
              if (!cellNode) return;
              const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
              const tableElement = getTableElement(
                tableNode,
                editor.getElementByKey(tableNode.getKey()),
              );
              if (!tableElement) return;
              tableRectRef.current = tableElement.getBoundingClientRect();
              activeCellElemRef.current = cell.elem;
              setActiveCell(cell);
            },
            { editor },
          );
        }
      } else {
        resetState();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      // touch 设备：无 hover，改用 pointerdown 触发
      if (event.pointerType === 'touch') onPointerMove(event);
    };

    return editor.registerRootListener((root, prevRoot) => {
      prevRoot?.removeEventListener('pointermove', onPointerMove);
      prevRoot?.removeEventListener('pointerdown', onPointerDown);
      root?.addEventListener('pointermove', onPointerMove);
      root?.addEventListener('pointerdown', onPointerDown);
    });
  }, [editor, resetState]);

  /** 提交列宽修改：以真实布局为基准 seed + 叠加拖拽增量 */
  const commitColumnWidth = useCallback(
    (delta: number) => {
      if (!activeCell) return;
      const cellElem = activeCell.elem;
      editor.update(() => {
        const cellNode = $getNearestNodeFromDOMNode(cellElem);
        if (!$isTableCellNode(cellNode)) return;
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
        const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);

        // 定位该单元格的列索引
        let columnIndex = 0;
        outer: for (let r = 0; r < tableMap.length; r++) {
          for (let c = 0; c < tableMap[r].length; c++) {
            if (tableMap[r][c]?.cell === cellNode) {
              columnIndex = c;
              break outer;
            }
          }
        }

        const zoom = calculateZoomLevel(cellElem);
        const colWidths = tableNode.getColWidths();
        if (colWidths) {
          const next = [...colWidths];
          const width = next[columnIndex] ?? 0;
          next[columnIndex] = Math.max(width + delta / zoom, MIN_COLUMN_WIDTH);
          tableNode.setColWidths(next);
          return;
        }

        // 尚无 colWidths：按当前等分布局 seed（table-fixed 默认各列等宽）
        const tableElement = getTableElement(
          tableNode,
          editor.getElementByKey(tableNode.getKey()),
        );
        const colCount = tableNode.getColumnCount();
        const tableWidth = tableElement
          ? tableElement.getBoundingClientRect().width
          : colCount * 100;
        const baseWidth = tableWidth / colCount;
        const next = Array.from({ length: colCount }, () =>
          Math.max(baseWidth, MIN_COLUMN_WIDTH),
        );
        next[columnIndex] = Math.max(
          baseWidth + delta / zoom,
          MIN_COLUMN_WIDTH,
        );
        tableNode.setColWidths(next);
      });
    },
    [editor, activeCell],
  );

  const startResize: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!activeCell) return;

      // 计算起始列索引
      const cellElem = activeCell.elem;
      let col: number | null = null;
      editor.getEditorState().read(() => {
        const cellNode = $getNearestNodeFromDOMNode(cellElem);
        if (!$isTableCellNode(cellNode)) return;
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(cellNode);
        const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null);
        outer: for (let r = 0; r < tableMap.length; r++) {
          for (let c = 0; c < tableMap[r].length; c++) {
            if (tableMap[r][c]?.cell === cellNode) {
              col = c;
              break outer;
            }
          }
        }
      });
      if (col === null) return;

      dragStartXRef.current = { x: event.clientX, col, shouldSeed: true };
      document.addEventListener('pointermove', onPointerMoveWhileResizing);
      document.addEventListener('pointerup', onPointerUpResize, { once: true });
    },
    [editor, activeCell],
  );

  const onPointerMoveWhileResizing = useCallback((event: PointerEvent) => {
    event.preventDefault();
    const start = dragStartXRef.current;
    if (!start) return;
    setDragOffset(event.clientX - start.x);
  }, []);

  const onPointerUpResize = useCallback(
    (event: PointerEvent) => {
      const start = dragStartXRef.current;
      if (start) {
        commitColumnWidth(event.clientX - start.x);
      }
      dragStartXRef.current = null;
      setDragOffset(null);
      document.removeEventListener('pointermove', onPointerMoveWhileResizing);
    },
    [commitColumnWidth, onPointerMoveWhileResizing],
  );

  // 手柄定位
  const handleStyle = useMemo(() => {
    if (!activeCell) return undefined;
    const rect = activeCell.elem.getBoundingClientRect();
    const zoom = calculateZoomLevel(activeCell.elem);
    const drag = dragOffset ?? 0;
    return {
      left: `${window.scrollX + rect.left + rect.width - HANDLE_WIDTH / 2 + drag / zoom}px`,
      top: `${window.scrollY + (tableRectRef.current?.top ?? rect.top) - 4}px`,
      height: `${(tableRectRef.current?.height ?? rect.height) + 8}px`,
      width: `${HANDLE_WIDTH}px`,
    } as const;
  }, [activeCell, dragOffset]);

  if (!activeCell) return null;
  return (
    <div
      className="table-cell-resizer-handle"
      onPointerDown={startResize}
      style={{
        ...handleStyle,
        position: 'absolute',
        zIndex: 10,
        cursor: 'col-resize',
        backgroundColor: '#60a5fa',
        opacity: 0.6,
        borderRadius: 4,
      }}
    />
  );
}

export default function TableCellResizerPlugin(): null | ReactPortal {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  return useMemo(
    () =>
      isEditable
        ? createPortal(<TableCellResizer editor={editor} />, document.body)
        : null,
    [editor, isEditable],
  );
}
