import { Eraser } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

interface ClearFormatGroupProps {
  onClear: () => void;
}

export function ClearFormatGroup({ onClear }: ClearFormatGroupProps) {
  return (
    <ToolbarButton title="Clear formatting" onClick={onClear}>
      <Eraser size={18} />
    </ToolbarButton>
  );
}
