import { FONT_FAMILIES, FONT_SIZES, MIXED_FONT_SIZE } from './constants';
import { ToolbarDropdown } from './ToolbarDropdown';

/**
 * 根据当前字体值匹配字体选项（参考 ca/lexical/packages/lib 实现）。
 * 无法匹配时兜底使用第一个选项（Arial）。
 */
function getFontFamilyItem(fontFamily: string) {
  const cleanCurrentFont = fontFamily.replace(/['"]/g, '').trim().toLowerCase();
  if (!cleanCurrentFont) {
    return FONT_FAMILIES[0];
  }
  return (
    FONT_FAMILIES.find((item) => {
      const cleanItemValue = item.value.toLowerCase();
      return (
        cleanItemValue.includes(cleanCurrentFont) ||
        cleanCurrentFont.includes(item.label.toLowerCase())
      );
    }) ?? FONT_FAMILIES[0]
  );
}

export interface FontGroupProps {
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
  const familyItem = getFontFamilyItem(fontFamily);
  const isMixed = fontSize === MIXED_FONT_SIZE;

  return (
    <>
      <ToolbarDropdown
        label="Font family"
        value={familyItem.value}
        options={FONT_FAMILIES}
        onChange={onFontFamilyChange}
        className="w-32.5"
        searchable
        searchPlaceholder="搜索字体..."
      />
      <ToolbarDropdown
        label="Font size"
        value={isMixed ? MIXED_FONT_SIZE : fontSize}
        options={FONT_SIZES.map((size) => ({ value: size, label: size }))}
        onChange={onFontSizeChange}
        placeholder={isMixed ? ' ' : undefined}
        className="w-19"
        searchable={false}
      />
    </>
  );
}
