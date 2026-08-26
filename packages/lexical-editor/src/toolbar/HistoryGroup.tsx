import { Redo2, Undo2 } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

interface HistoryGroupProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function HistoryGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: HistoryGroupProps) {
  return (
    <>
      <ToolbarButton title="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={18} />
      </ToolbarButton>
      <ToolbarButton title="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo2 size={18} />
      </ToolbarButton>
    </>
  );
}
