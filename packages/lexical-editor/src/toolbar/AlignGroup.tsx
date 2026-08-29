import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  Indent,
  Outdent,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { t, type Locale } from '../i18n';
import { useLocale } from '../LocaleContext';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopup } from './ToolbarPopup';
import type { AlignType } from './types';

interface AlignGroupProps {
  activeAlign: AlignType;
  isRTL?: boolean;
  onAlign: (align: AlignType) => void;
  onOutdent: () => void;
  onIndent: () => void;
  onToggleRTL?: () => void;
}

function getAlignOptions(locale: Locale) {
  return [
    { value: 'left', label: t(locale, 'alignLeft'), Icon: AlignLeft },
    { value: 'center', label: t(locale, 'alignCenter'), Icon: AlignCenter },
    { value: 'right', label: t(locale, 'alignRight'), Icon: AlignRight },
    { value: 'justify', label: t(locale, 'alignJustify'), Icon: AlignJustify },
  ] as const;
}

/**
 * 对齐下拉：将左/右/居中对齐、两端对齐合并为一个下拉选项。
 * 按钮展示当前对齐图标，点击展开选项列表。
 */
function AlignDropdown({
  activeAlign,
  onAlign,
}: {
  activeAlign: AlignType;
  onAlign: (align: AlignType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const alignOptions = getAlignOptions(locale);
  const active = alignOptions.find((o) => o.value === activeAlign);
  const ActiveIcon = active?.Icon ?? AlignLeft;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t(locale, 'alignLeft')}
        aria-label={t(locale, 'alignLeft')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-8 w-9 items-center justify-center gap-0.5 rounded-md border border-transparent text-gray-700',
          'transition-colors hover:bg-gray-100',
          // 非默认左对齐时高亮，提示当前对齐状态
          activeAlign !== 'left' ? 'bg-blue-50 text-blue-600' : '',
        ].join(' ')}
      >
        <ActiveIcon size={18} />
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={() => setOpen(false)}
          className="w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <ul className="py-1">
            {alignOptions.map(({ value, label, Icon }) => (
              <li key={value}>
                <button
                  type="button"
                  // biome-ignore lint/a11y/useSemanticElements: custom dropdown option
                  role="option"
                  aria-selected={value === activeAlign}
                  onClick={() => {
                    onAlign(value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 ${
                    value === activeAlign
                      ? 'font-medium text-blue-600'
                      : 'text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    <span>{label}</span>
                  </span>
                  {value === activeAlign && (
                    <Check size={14} className="shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </ToolbarPopup>
      )}
    </div>
  );
}

export function AlignGroup({
  activeAlign,
  onAlign,
  onOutdent,
  onIndent,
}: AlignGroupProps) {
  const locale = useLocale();
  return (
    <>
      <AlignDropdown activeAlign={activeAlign} onAlign={onAlign} />
      <ToolbarButton title={t(locale, 'outdent')} onClick={onOutdent}>
        <Outdent size={18} />
      </ToolbarButton>
      <ToolbarButton title={t(locale, 'indent')} onClick={onIndent}>
        <Indent size={18} />
      </ToolbarButton>
    </>
  );
}
