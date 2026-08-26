import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Indent,
  Outdent,
} from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import type { AlignType } from './types';

interface AlignGroupProps {
  activeAlign: AlignType;
  isRTL: boolean;
  onAlign: (align: AlignType) => void;
  onOutdent: () => void;
  onIndent: () => void;
  onToggleRTL: () => void;
}

export function AlignGroup({
  activeAlign,
  isRTL,
  onAlign,
  onOutdent,
  onIndent,
  onToggleRTL,
}: AlignGroupProps) {
  return (
    <>
      <ToolbarButton
        title="Align left"
        active={activeAlign === 'left'}
        onClick={() => onAlign('left')}
      >
        <AlignLeft size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Align center"
        active={activeAlign === 'center'}
        onClick={() => onAlign('center')}
      >
        <AlignCenter size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Align right"
        active={activeAlign === 'right'}
        onClick={() => onAlign('right')}
      >
        <AlignRight size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Justify"
        active={activeAlign === 'justify'}
        onClick={() => onAlign('justify')}
      >
        <AlignJustify size={18} />
      </ToolbarButton>
      <ToolbarButton title="Outdent" onClick={onOutdent}>
        <Outdent size={18} />
      </ToolbarButton>
      <ToolbarButton title="Indent" onClick={onIndent}>
        <Indent size={18} />
      </ToolbarButton>
      <ToolbarButton title="Right-to-left" active={isRTL} onClick={onToggleRTL}>
        RTL
      </ToolbarButton>
    </>
  );
}
