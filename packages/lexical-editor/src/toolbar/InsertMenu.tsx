import {
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquarePlus,
  Table as TableIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { t, type Locale } from '../i18n';
import { useLocale } from '../LocaleContext';
import { TableSizePicker } from './TableSizePicker';
import { ToolbarPopup } from './ToolbarPopup';
import type { InsertBlockType } from './types';

interface InsertMenuProps {
  onInsert: (type: InsertBlockType) => void;
  onInsertTable: (rows: number, cols: number) => void;
}

interface InsertItem {
  type: InsertBlockType;
  label: string;
  icon: typeof Pilcrow;
}

interface InsertSection {
  title: string;
  items: InsertItem[];
}

function getSections(locale: Locale): InsertSection[] {
  return [
    {
      title: t(locale, 'insertBlocks'),
      items: [
        { type: 'paragraph', label: t(locale, 'insertParagraph'), icon: Pilcrow },
        { type: 'h1', label: t(locale, 'insertH1'), icon: Heading1 },
        { type: 'h2', label: t(locale, 'insertH2'), icon: Heading2 },
        { type: 'h3', label: t(locale, 'insertH3'), icon: Heading3 },
        { type: 'h4', label: t(locale, 'insertH4'), icon: Heading4 },
        { type: 'quote', label: t(locale, 'insertQuote'), icon: Quote },
        { type: 'code', label: t(locale, 'insertCodeBlock'), icon: Code },
      ],
    },
    {
      title: t(locale, 'insertLists'),
      items: [
        { type: 'bullet', label: t(locale, 'insertBulletList'), icon: List },
        { type: 'number', label: t(locale, 'insertNumberedList'), icon: ListOrdered },
        { type: 'check', label: t(locale, 'insertCheckList'), icon: ListChecks },
      ],
    },
    {
      title: t(locale, 'insertObjects'),
      items: [
        { type: 'table', label: t(locale, 'insertTable'), icon: TableIcon },
        { type: 'divider', label: t(locale, 'insertDivider'), icon: Minus },
        { type: 'image', label: t(locale, 'insertImage'), icon: ImageIcon },
      ],
    },
  ];
}

export function InsertMenu({ onInsert, onInsertTable }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  const closeMenu = () => {
    setOpen(false);
    setTablePickerOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={t(locale, 'insert')}
        aria-label={t(locale, 'insert')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-blue-400"
      >
        <SquarePlus size={18} />
        <span>{t(locale, 'insert')}</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={closeMenu}
          className="max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {tablePickerOpen ? (
            <TableSizePicker
              onSelect={(rows, cols) => {
                onInsertTable(rows, cols);
                closeMenu();
              }}
              onCancel={() => setTablePickerOpen(false)}
            />
          ) : (
            getSections(locale).map((section) => (
              <div key={section.title}>
                <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {section.title}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (item.type === 'table') {
                        setTablePickerOpen(true);
                        return;
                      }
                      onInsert(item.type);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    <item.icon size={16} className="shrink-0 text-gray-500" />
                    {item.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </ToolbarPopup>
      )}
    </div>
  );
}
