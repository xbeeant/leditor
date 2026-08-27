import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ToolbarPopup } from './ToolbarPopup';

export interface DropdownOption {
  value: string;
  label: string;
}

interface ToolbarDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function ToolbarDropdown({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
  searchable = true,
  searchPlaceholder = 'Search…',
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected ? selected.label : (placeholder ?? label);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  return (
    <div ref={ref} className={`relative ${className ?? 'w-30'}`}>
      <button
        type="button"
        title={label}
        aria-label={label}
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
          className="w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {searchable && (
            <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-1.5">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
          )}
          {/* biome-ignore lint/a11y/useFocusableInteractive lint/a11y/noNoninteractiveElementToInteractiveRole lint/a11y/useSemanticElements: custom searchable dropdown listbox */}
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-1.5 text-sm text-gray-400">No results</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    // biome-ignore lint/a11y/useSemanticElements: custom dropdown option
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 ${
                      o.value === value
                        ? 'font-medium text-blue-600'
                        : 'text-gray-700'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && (
                      <Check size={14} className="shrink-0" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </ToolbarPopup>
      )}
    </div>
  );
}
