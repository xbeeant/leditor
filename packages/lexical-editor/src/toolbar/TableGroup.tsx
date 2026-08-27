import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $findCellNode,
  $findTableNode,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  type TableCellNode,
} from '@lexical/table';
import { $getSelection, $isRangeSelection } from 'lexical';
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Combine,
  PaintBucket,
  SquareSplitHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ColorList } from './ColorGroup';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopup } from './ToolbarPopup';

const initialState = {
  inTable: false,
  canMerge: false,
  canUnmerge: false,
  backgroundColor: '#ffffff',
};

export function TableGroup() {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState(initialState);
  const [bgOpen, setBgOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const selection = $getSelection();
      if ($isTableSelection(selection)) {
        const shape = selection.getShape();
        setState({
          inTable: true,
          canMerge: shape.toX > shape.fromX || shape.toY > shape.fromY,
          canUnmerge: false,
          backgroundColor: '#ffffff',
        });
        return;
      }
      if ($isRangeSelection(selection)) {
        const cell = $findCellNode(selection.anchor.getNode());
        if (cell === null) {
          setState((prev) => (prev.inTable ? initialState : prev));
          return;
        }
        setState({
          inTable: true,
          canMerge: false,
          canUnmerge: cell.getColSpan() > 1 || cell.getRowSpan() > 1,
          backgroundColor: cell.getBackgroundColor() ?? '#ffffff',
        });
        return;
      }
      setState((prev) => (prev.inTable ? initialState : prev));
    };
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(update);
    });
    return removeListener;
  }, [editor]);

  if (!state.inTable) {
    return null;
  }

  const mergeCells = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isTableSelection(selection)) {
        return;
      }
      const cells = selection.getNodes().filter($isTableCellNode);
      if (cells.length < 2) {
        return;
      }
      const target = $mergeCells(cells);
      if (target !== null) {
        target.selectEnd();
      }
    });
  };

  const splitCell = () => {
    editor.update(() => {
      $unmergeCell();
    });
  };

  const setCellBackground = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isTableSelection(selection)) {
        for (const node of selection.getNodes()) {
          if ($isTableCellNode(node)) {
            node.setBackgroundColor(color || null);
          }
        }
      } else if ($isRangeSelection(selection)) {
        const cell = $findCellNode(selection.anchor.getNode());
        if (cell !== null) {
          cell.setBackgroundColor(color || null);
        }
      }
    });
  };

  const setCellVerticalAlign = (value: 'top' | 'middle' | 'bottom') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isTableSelection(selection)) {
        for (const node of selection.getNodes()) {
          if ($isTableCellNode(node)) {
            node.setVerticalAlign(value);
          }
        }
      } else if ($isRangeSelection(selection)) {
        const cell = $findCellNode(selection.anchor.getNode());
        if (cell !== null) {
          cell.setVerticalAlign(value);
        }
      }
    });
  };

  const deleteTable = () => {
    editor.update(() => {
      const selection = $getSelection();
      let cell: TableCellNode | null = null;
      if ($isTableSelection(selection)) {
        for (const node of selection.getNodes()) {
          if ($isTableCellNode(node)) {
            cell = node;
            break;
          }
        }
      } else if ($isRangeSelection(selection)) {
        cell = $findCellNode(selection.anchor.getNode());
      }
      if (cell === null) {
        return;
      }
      const table = $findTableNode(cell);
      if (table !== null) {
        table.remove();
      }
    });
  };

  const indicator =
    state.backgroundColor === 'transparent' ? '#ffffff' : state.backgroundColor;

  return (
    <>
      <ToolbarButton
        title="合并单元格"
        disabled={!state.canMerge}
        onClick={mergeCells}
      >
        <Combine size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="拆分单元格"
        disabled={!state.canUnmerge}
        onClick={splitCell}
      >
        <SquareSplitHorizontal size={18} />
      </ToolbarButton>
      <div ref={bgRef} className="relative">
        <ToolbarButton
          title="单元格背景色"
          onClick={() => setBgOpen((v) => !v)}
        >
          <span className="relative inline-flex flex-col items-center">
            <PaintBucket size={18} />
            <span
              className="absolute -bottom-0.5 h-1 w-4 rounded-sm ring-1 ring-gray-200"
              style={{ backgroundColor: indicator }}
            />
          </span>
        </ToolbarButton>
        {bgOpen && (
          <ToolbarPopup
            anchorRef={bgRef}
            open={bgOpen}
            onClose={() => setBgOpen(false)}
            className="w-72 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
          >
            <ColorList
              group="background"
              title="单元格背景色"
              value={state.backgroundColor}
              onSelect={setCellBackground}
              onClose={() => setBgOpen(false)}
            />
          </ToolbarPopup>
        )}
      </div>
      <div ref={alignRef} className="relative">
        <ToolbarButton
          title="单元格垂直对齐"
          onClick={() => setAlignOpen((v) => !v)}
        >
          <AlignVerticalJustifyCenter size={18} />
        </ToolbarButton>
        {alignOpen && (
          <ToolbarPopup
            anchorRef={alignRef}
            open={alignOpen}
            onClose={() => setAlignOpen(false)}
            className="flex gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
          >
            <ToolbarButton
              title="顶部对齐"
              onClick={() => {
                setCellVerticalAlign('top');
                setAlignOpen(false);
              }}
            >
              <AlignVerticalJustifyStart size={16} />
            </ToolbarButton>
            <ToolbarButton
              title="垂直居中"
              onClick={() => {
                setCellVerticalAlign('middle');
                setAlignOpen(false);
              }}
            >
              <AlignVerticalJustifyCenter size={16} />
            </ToolbarButton>
            <ToolbarButton
              title="底部对齐"
              onClick={() => {
                setCellVerticalAlign('bottom');
                setAlignOpen(false);
              }}
            >
              <AlignVerticalJustifyEnd size={16} />
            </ToolbarButton>
          </ToolbarPopup>
        )}
      </div>
      <ToolbarButton title="删除表格" onClick={deleteTable}>
        <Trash2 size={18} />
      </ToolbarButton>
    </>
  );
}
