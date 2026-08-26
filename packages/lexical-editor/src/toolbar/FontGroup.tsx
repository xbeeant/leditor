import { ToolbarDropdown } from './ToolbarDropdown';
import { FONT_FAMILIES, FONT_SIZES } from './constants';

interface FontGroupProps {
  fontFamily: string;
  onFontFamilyChange: (family: string) => void;
  fontSize: string;
  onFontSizeChange: (size: string) => void;
}

export function FontGroup({
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
}: FontGroupProps) {
  const familyOptions = [
    { value: '', label: 'Default' },
    ...FONT_FAMILIES.map((f) => ({ value: f, label: f })),
  ];
  const sizeOptions = [
    { value: '', label: '–' },
    ...FONT_SIZES.map((s) => ({ value: String(s), label: String(s) })),
  ];

  return (
    <>
      <ToolbarDropdown
        label="Font family"
        value={fontFamily}
        options={familyOptions}
        onChange={onFontFamilyChange}
        className="min-w-[120px]"
      />
      <ToolbarDropdown
        label="Font size"
        value={fontSize}
        options={sizeOptions}
        onChange={onFontSizeChange}
        className="w-16"
        searchable={false}
      />
    </>
  );
}
