import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  type TableCellNode,
} from '@lexical/table';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
} from '@lexical/table';
import {
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  type ElementFormatType,
} from 'lexical';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Columns2,
  Combine,
  type LucideIcon,
  Plus,
  Rows2,
  Scissors,
  Trash2,
} from 'lucide-react';
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ColorList } from './toolbar/ColorGroup';

interface MenuState {
  x: number;
  y: number;
  cellKey: string;
}

/** Horizontal alignment options (applied to paragraphs inside the cell). */
const H_ALIGNS = [
  ['left', AlignLeft],
  ['center', AlignCenter],
  ['right', AlignRight],
  ['justify', AlignJustify],
] as const;

/** Vertical alignment options (applied to the cell itself). */
const V_ALIGNS = ['top', 'middle', 'bottom'] as const;

function MenuItem({
  label,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 ${
        danger ? 'text-red-600' : ''
      }`}
      onClick={onClick}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function MenuLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pb-1 pt-1.5 text-xs font-medium text-gray-400">
      {children}
    </div>
  );
}

/** Horizontally align every block element inside the cell. */
function $setCellAlign(cell: TableCellNode, align: ElementFormatType): void {
  for (const child of cell.getChildren()) {
    if ($isElementNode(child)) {
      child.setFormat(align);
    }
  }
}

const MENU_GAP = 8;

export function TableActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [isTableSelection, setIsTableSelection] = useState(false);
  const [isMergedCell, setIsMergedCell] = useState(false);
  const [cellBgColor, setCellBgColor] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null,
  );

  // Keep the whole menu inside the viewport: measure its real size after
  // opening and clamp it so actions near the bottom (background color,
  // alignment…) are never cut off.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || !menu) {
      return;
    }
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setMenuPos({
      left: Math.max(MENU_GAP, Math.min(menu.x, vw - width - MENU_GAP)),
      top: Math.max(MENU_GAP, Math.min(menu.y, vh - height - MENU_GAP)),
    });
  }, [menu]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const cell = target?.closest('td, th') as HTMLElement | null;
      const cellKey = cell?.getAttribute('data-lexical-node-key');
      if (!cellKey) return;
      event.preventDefault();
      // Detect whether multiple cells are selected (drag-select) so the
      // "Merge cells" action can be offered; also detect if the clicked
      // cell is itself a merged cell so "Split cell" can be offered.
      const sel = editor
        .getEditorState()
        .read(() => $getSelection(), { editor });
      setIsTableSelection($isTableSelection(sel));
      setIsMergedCell(
        editor.getEditorState().read(
          () => {
            const node = $getNodeByKey(cellKey);
            return (
              !!node &&
              $isTableCellNode(node) &&
              (node.getColSpan() > 1 || node.getRowSpan() > 1)
            );
          },
          { editor },
        ),
      );
      setCellBgColor(
        editor
          .getEditorState()
          .read(
            () => {
              const node = $getNodeByKey(cellKey);
              return node && $isTableCellNode(node)
                ? (node.getBackgroundColor() ?? '')
                : '';
            },
            { editor },
          ),
      );
      setMenu({ x: event.clientX, y: event.clientY, cellKey });
    };

    const onClickAway = () => setMenu(null);

    root.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', onClickAway);
    return () => {
      root.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousedown', onClickAway);
    };
  }, [editor]);

  if (!menu) return null;

  const run = (action: () => void) => {
    editor.update(() => {
      const cell = $getNodeByKey(menu.cellKey);
      if (cell && $isTableCellNode(cell)) {
        cell.selectStart();
        action();
      }
    });
    setMenu(null);
  };

  /** Apply an operation to every selected cell (or the clicked one). */
  const applyToCells = (fn: (cell: TableCellNode) => void) => {
    editor.update(() => {
      const selection = $getSelection();
      let cells: TableCellNode[] = [];
      if ($isTableSelection(selection)) {
        cells = selection.getNodes().filter($isTableCellNode);
      }
      if (cells.length === 0) {
        const node = $getNodeByKey(menu.cellKey);
        if (node && $isTableCellNode(node)) {
          cells = [node];
        }
      }
      cells.forEach(fn);
    });
    setMenu(null);
  };

  const mergeCells = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isTableSelection(selection)) {
        const cells = selection.getNodes().filter($isTableCellNode);
        if (cells.length > 1) {
          const merged = $mergeCells(cells);
          // Clear the stale table selection and put the caret in the new
          // merged cell.
          if (merged) {
            merged.selectStart();
          }
        }
      }
    });
    setMenu(null);
  };

  const splitCell = () => {
    run(() => $unmergeCell());
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 max-h-[calc(100vh-16px)] w-64 overflow-y-auto rounded border border-gray-200 bg-white py-1 text-sm shadow-xl"
      style={{
        left: menuPos?.left ?? -9999,
        top: menuPos?.top ?? -9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MenuItem
        label="Insert row above"
        icon={ArrowUp}
        onClick={() => run(() => $insertTableRowAtSelection(false))}
      />
      <MenuItem
        label="Insert row below"
        icon={ArrowDown}
        onClick={() => run(() => $insertTableRowAtSelection(true))}
      />
      <MenuItem
        label="Insert column before"
        icon={Columns2}
        onClick={() => run(() => $insertTableColumnAtSelection(false))}
      />
      <MenuItem
        label="Insert column after"
        icon={Plus}
        onClick={() => run(() => $insertTableColumnAtSelection(true))}
      />
      <div className="my-1 border-t border-gray-100" />
      <MenuItem
        label="Delete row"
        icon={Rows2}
        onClick={() => run(() => $deleteTableRowAtSelection())}
      />
      <MenuItem
        label="Delete column"
        icon={Columns2}
        onClick={() => run(() => $deleteTableColumnAtSelection())}
      />
      <MenuItem
        label="Delete table"
        icon={Trash2}
        danger
        onClick={() =>
          run(() => {
            const cell = $getNodeByKey(menu.cellKey);
            if (cell && $isTableCellNode(cell)) {
              const table = $findTableNode(cell);
              table?.remove();
            }
          })
        }
      />
      {(isTableSelection || isMergedCell) && (
        <>
          <div className="my-1 border-t border-gray-100" />
          {isTableSelection && (
            <MenuItem label="Merge cells" icon={Combine} onClick={mergeCells} />
          )}
          {isMergedCell && (
            <MenuItem label="Split cell" icon={Scissors} onClick={splitCell} />
          )}
        </>
      )}
      <div className="my-1 border-t border-gray-100" />
      <ColorList
        group="background"
        title="Cell background"
        value={cellBgColor}
        onSelect={(value) =>
          applyToCells((c) => c.setBackgroundColor(value || null))
        }
        onClose={() => setMenu(null)}
      />
      <div className="my-1 border-t border-gray-100" />
      <MenuLabel>Horizontal align</MenuLabel>
      <div className="flex gap-1 px-3 pb-2">
        {H_ALIGNS.map(([align, Icon]) => (
          <button
            key={align}
            type="button"
            title={`Align ${align}`}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100"
            onClick={() => applyToCells((c) => $setCellAlign(c, align))}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="my-1 border-t border-gray-100" />
      <MenuLabel>Vertical align</MenuLabel>
      <div className="flex gap-1 px-3 pb-2">
        {V_ALIGNS.map((align) => (
          <button
            key={align}
            type="button"
            title={`Align ${align}`}
            className="h-6 flex-1 rounded border border-gray-300 text-xs capitalize text-gray-600 transition-colors hover:bg-gray-100"
            onClick={() => applyToCells((c) => c.setVerticalAlign(align))}
          >
            {align}
          </button>
        ))}
      </div>
    </div>
  );
}
