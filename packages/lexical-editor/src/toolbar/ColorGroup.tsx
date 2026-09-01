import { Check, ChevronDown } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import { ToolbarPopup } from './ToolbarPopup';
import { type ColorOption, colors } from './colors';

/** 色块图标（"A" 字显示颜色，参考 ca/lexical/packages/lib 实现） */
export function ColorIcon({
  group,
  value,
}: {
  group: 'color' | 'background';
  value: string;
}) {
  return (
    <div
      className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-gray-300 text-[11px] font-semibold"
      style={
        group === 'background' ? { backgroundColor: value } : { color: value }
      }
    >
      A
    </div>
  );
}

interface ColorListProps {
  group: 'color' | 'background';
  title: string;
  value: string;
  /** 可选的颜色枚举，默认使用 `colors` */
  palette?: ColorOption[];
  /** 布局方式：grid 双列换行（默认）；column 单列纵向（用于左右分栏的窄栏） */
  layout?: 'grid' | 'column';
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function ColorList({
  group,
  title,
  value,
  palette,
  layout = 'grid',
  onSelect,
  onClose,
}: ColorListProps) {
  const isSelected = (c: string) =>
    value === c || (value === 'transparent' && c === '');
  const list = palette ?? colors;
  const isColumn = layout === 'column';

  return (
    <>
      <div className="px-3 pb-1 text-xs font-medium text-gray-500">{title}</div>
      <div
        className={`flex max-h-72 flex-col gap-y-0.5 overflow-y-auto px-1 ${
          isColumn ? '' : 'flex-wrap'
        }`}
      >
        {list.map(({ value: c, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              onSelect(c);
              onClose();
            }}
            className={`flex min-w-0 items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-gray-100 ${
              isColumn ? 'w-full' : 'w-1/2'
            } ${isSelected(c) ? 'text-blue-600' : 'text-gray-700'}`}
          >
            <ColorIcon group={group} value={c} />
            <span className="truncate">{label}</span>
            {isSelected(c) && <Check size={14} className="ml-auto shrink-0" />}
          </button>
        ))}
      </div>
    </>
  );
}

export interface ColorGroupProps {
  fontColor: string;
  bgColor: string;
  onFontColorChange: (color: string) => void;
  onBgColorChange: (color: string) => void;
}

/** 文字颜色 / 背景色（参考 ca/lexical/packages/lib 实现） */
export const ColorGroup = memo(function ColorGroup({
  fontColor,
  bgColor,
  onFontColorChange,
  onBgColorChange,
}: ColorGroupProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t(locale, 'textColorAndBg')}
        aria-label={t(locale, 'textColorAndBg')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-12 cursor-pointer items-center justify-center gap-0.5 rounded-md border border-gray-200 bg-white transition-colors hover:border-gray-300 hover:bg-gray-100"
      >
        <div
          className="size-4 rounded-full"
          style={{
            background:
              'linear-gradient(120deg, #6EB6F2 20%, #a855f7, #ea580c, #eab308 80%)',
          }}
        />
        <ChevronDown
          size={12}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={() => setOpen(false)}
          align="end"
          className="w-100 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
        >
          <div className="flex items-stretch">
            <div className="min-w-0 flex-1">
              <ColorList
                group="color"
                title={t(locale, 'textColor')}
                value={fontColor}
                layout="column"
                onSelect={onFontColorChange}
                onClose={() => setOpen(false)}
              />
            </div>
            <div className="mx-1 w-px shrink-0 bg-gray-100" />
            <div className="min-w-0 flex-1">
              <ColorList
                group="background"
                title={t(locale, 'bgColor')}
                value={bgColor}
                layout="column"
                onSelect={onBgColorChange}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </ToolbarPopup>
      )}
    </div>
  );
});
