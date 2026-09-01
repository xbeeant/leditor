import { Check, ChevronDown } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { type Locale, t } from '../i18n';
import { ToolbarPopup } from './ToolbarPopup';
import type { BlockType } from './types';

interface BlockOption {
  value: string;
  label: string;
  marker?: React.ReactNode;
}

interface BlockOptionGroup {
  label: string;
  options: BlockOption[];
}

function getBlockGroups(locale: Locale): BlockOptionGroup[] {
  return [
    {
      label: t(locale, 'text'),
      options: [
        { value: 'paragraph', label: t(locale, 'paragraph') },
        { value: 'h1', label: t(locale, 'heading1') },
        { value: 'h2', label: t(locale, 'heading2') },
        { value: 'h3', label: t(locale, 'heading3') },
        { value: 'h4', label: t(locale, 'heading4') },
      ],
    },
    {
      label: t(locale, 'list'),
      options: [
        { value: 'bullet', label: t(locale, 'bulletList') },
        { value: 'number', label: t(locale, 'numberedList') },
        { value: 'check', label: t(locale, 'checklist') },
      ],
    },
    {
      label: t(locale, 'bulletStyle'),
      options: [
        {
          value: 'bullet-disc',
          label: t(locale, 'default'),
          marker: (
            <span className="inline-block h-2 w-2 rounded-full bg-gray-700" />
          ),
        },
        {
          value: 'bullet-circle',
          label: t(locale, 'circle'),
          marker: (
            <span className="inline-block h-2 w-2 rounded-full border border-gray-700 bg-transparent" />
          ),
        },
        {
          value: 'bullet-square',
          label: t(locale, 'square'),
          marker: <span className="inline-block h-2 w-2 bg-gray-700" />,
        },
      ],
    },
    {
      label: t(locale, 'numberStyle'),
      options: [
        {
          value: 'number-decimal',
          label: t(locale, 'numberDecimal'),
          marker: (
            <span className="w-4 text-center text-xs text-gray-500">1.</span>
          ),
        },
        {
          value: 'lower-alpha',
          label: t(locale, 'lowerAlpha'),
          marker: (
            <span className="w-4 text-center text-xs text-gray-500">a.</span>
          ),
        },
        {
          value: 'upper-alpha',
          label: t(locale, 'upperAlpha'),
          marker: (
            <span className="w-4 text-center text-xs text-gray-500">A.</span>
          ),
        },
        {
          value: 'lower-roman',
          label: t(locale, 'lowerRoman'),
          marker: (
            <span className="w-4 text-center text-xs text-gray-500">i.</span>
          ),
        },
        {
          value: 'upper-roman',
          label: t(locale, 'upperRoman'),
          marker: (
            <span className="w-4 text-center text-xs text-gray-500">I.</span>
          ),
        },
      ],
    },
    {
      label: t(locale, 'block'),
      options: [
        { value: 'quote', label: t(locale, 'quote') },
        { value: 'code', label: t(locale, 'codeBlock') },
      ],
    },
  ];
}

interface BlockGroupProps {
  blockType: BlockType;
  onBlockTypeChange: (value: BlockType) => void;
  codeLanguage: string;
  onCodeLanguageChange: (language: string) => void;
  onBulletStyleChange?: (style: 'disc' | 'circle' | 'square') => void;
}

export const BlockGroup = memo(function BlockGroup({
  blockType,
  onBlockTypeChange,
  codeLanguage,
  onCodeLanguageChange,
  onBulletStyleChange,
}: BlockGroupProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const blockGroups = getBlockGroups(locale);
  const allOptions = blockGroups.flatMap((g) => g.options);
  const selected = allOptions.find((o) => o.value === blockType);
  const display = selected ? selected.label : t(locale, 'paragraph');

  return (
    <>
      <div ref={ref} className="relative min-w-30">
        <button
          type="button"
          title={t(locale, 'paragraphStyle')}
          aria-label={t(locale, 'paragraphStyle')}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300"
        >
          <span className="truncate">{display}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <ToolbarPopup
            anchorRef={ref}
            open={open}
            onClose={() => setOpen(false)}
            className="w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="max-h-80 overflow-y-auto">
              {blockGroups.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div className="my-1 border-t border-gray-100" />}
                  <div className="px-3 py-1 text-xs font-medium text-gray-400">
                    {group.label}
                  </div>
                  {group.options.map((o) => {
                    const isBulletStyle = o.value.startsWith('bullet-');
                    const isOrderedStyle =
                      o.value === 'number-decimal' ||
                      o.value === 'lower-alpha' ||
                      o.value === 'upper-alpha' ||
                      o.value === 'lower-roman' ||
                      o.value === 'upper-roman';
                    const isActive =
                      isBulletStyle || isOrderedStyle
                        ? false
                        : o.value === blockType;
                    return (
                      <button
                        key={o.value}
                        // biome-ignore lint/a11y/useSemanticElements: custom dropdown option
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          if (isBulletStyle) {
                            const style = o.value.replace('bullet-', '') as
                              | 'disc'
                              | 'circle'
                              | 'square';
                            onBlockTypeChange('bullet');
                            onBulletStyleChange?.(style);
                          } else if (isOrderedStyle) {
                            if (o.value === 'number-decimal') {
                              onBlockTypeChange('number');
                            } else {
                              onBlockTypeChange(o.value as BlockType);
                            }
                          } else {
                            onBlockTypeChange(o.value as BlockType);
                          }
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 ${
                          isActive
                            ? 'font-medium text-blue-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {o.marker && (
                          <span className="flex w-4 shrink-0 items-center justify-center">
                            {o.marker}
                          </span>
                        )}
                        <span className="truncate">{o.label}</span>
                        {isActive && (
                          <Check size={14} className="ml-auto shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </ToolbarPopup>
        )}
      </div>

      {blockType === 'code' && (
        <CodeLanguageDropdown
          value={codeLanguage}
          onChange={onCodeLanguageChange}
        />
      )}
    </>
  );
});

function CodeLanguageDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  return (
    <div ref={ref} className="relative w-32">
      <button
        type="button"
        title={t(locale, 'codeLang')}
        aria-label={t(locale, 'codeLang')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={() => setOpen(false)}
          className="w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          <div className="max-h-60 overflow-y-auto">
            {[
              'javascript',
              'typescript',
              'python',
              'java',
              'c',
              'cpp',
              'go',
              'rust',
              'html',
              'css',
              'json',
              'sql',
              'bash',
              'markdown',
            ].map((lang) => (
              <button
                key={lang}
                // biome-ignore lint/a11y/useSemanticElements: custom dropdown option
                type="button"
                role="option"
                aria-selected={lang === value}
                onClick={() => {
                  onChange(lang);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 ${
                  lang === value ? 'font-medium text-blue-600' : 'text-gray-700'
                }`}
              >
                <span className="truncate">{lang}</span>
                {lang === value && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
        </ToolbarPopup>
      )}
    </div>
  );
}
