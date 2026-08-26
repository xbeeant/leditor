import { ColorButton } from './ColorButton';
import { BG_COLORS, TEXT_COLORS } from './constants';

interface ColorGroupProps {
  fontColor: string;
  bgColor: string;
  onFontColorChange: (color: string) => void;
  onBgColorChange: (color: string) => void;
}

export function ColorGroup({
  fontColor,
  bgColor,
  onFontColorChange,
  onBgColorChange,
}: ColorGroupProps) {
  return (
    <>
      <ColorButton
        label="Text color"
        color={fontColor}
        colors={TEXT_COLORS}
        onChange={onFontColorChange}
      />
      <ColorButton
        label="Highlight"
        color={bgColor}
        colors={BG_COLORS}
        onChange={onBgColorChange}
      />
    </>
  );
}
