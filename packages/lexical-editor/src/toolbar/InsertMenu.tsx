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
import { useEffect, useRef, useState } from 'react';
import type { InsertBlockType } from './types';

interface InsertMenuProps {
  onInsert: (type: InsertBlockType) => void;
}

interface InsertItem {
  type: InsertBlockType;
  label: string;
  icon: typeof Pilcrow;
}

const SECTIONS: { title: string; items: InsertItem[] }[] = [
  {
    title: 'Blocks',
    items: [
      { type: 'paragraph', label: 'Paragraph', icon: Pilcrow },
      { type: 'h1', label: 'Heading 1', icon: Heading1 },
      { type: 'h2', label: 'Heading 2', icon: Heading2 },
      { type: 'h3', label: 'Heading 3', icon: Heading3 },
      { type: 'h4', label: 'Heading 4', icon: Heading4 },
      { type: 'quote', label: 'Quote', icon: Quote },
      { type: 'code', label: 'Code block', icon: Code },
    ],
  },
  {
    title: 'Lists',
    items: [
      { type: 'bullet', label: 'Bulleted list', icon: List },
      { type: 'number', label: 'Numbered list', icon: ListOrdered },
      { type: 'check', label: 'Check list', icon: ListChecks },
    ],
  },
  {
    title: 'Objects',
    items: [
      { type: 'table', label: 'Table', icon: TableIcon },
      { type: 'divider', label: 'Divider', icon: Minus },
      { type: 'image', label: 'Image', icon: ImageIcon },
    ],
  },
];

export function InsertMenu({ onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Insert"
        aria-label="Insert"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-blue-400"
      >
        <SquarePlus size={18} />
        <span>Insert</span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {SECTIONS.map((section) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
