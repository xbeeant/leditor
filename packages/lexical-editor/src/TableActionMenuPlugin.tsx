import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isTableCellNode } from '@lexical/table';
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
} from '@lexical/table';
import { $getNodeByKey } from 'lexical';
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  type LucideIcon,
  Plus,
  Rows2,
  Trash2,
} from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

interface MenuState {
  x: number;
  y: number;
  cellKey: string;
}

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

export function TableActionMenuPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const cell = target?.closest('td, th') as HTMLElement | null;
      const cellKey = cell?.getAttribute('data-lexical-node-key');
      if (!cellKey) return;
      event.preventDefault();
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

  return (
    <div
      className="fixed z-50 min-w-[200px] rounded border border-gray-200 bg-white py-1 text-sm shadow-xl"
      style={{ left: menu.x, top: menu.y }}
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
    </div>
  );
}
