import { Link as LinkIcon, X } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import { useLocale } from '../context';
import { t } from '../i18n';
import { ToolbarButton } from './toolbar-button';
import { ToolbarPopup } from './toolbar-popup';

interface LinkGroupProps {
  active: boolean;
  open: boolean;
  url: string;
  onToggle: () => void;
  onUrlChange: (url: string) => void;
  onCommit: () => void;
  onClose: () => void;
}

function isValidUrl(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed === '') return true;
  try {
    new URL(trimmed);
    return true;
  } catch {
    try {
      new URL(`https://${trimmed}`);
      return true;
    } catch {
      return false;
    }
  }
}

export const LinkGroup = memo(function LinkGroup({
  active,
  open,
  url,
  onToggle,
  onUrlChange,
  onCommit,
  onClose,
}: LinkGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const valid = useMemo(() => isValidUrl(url), [url]);
  const locale = useLocale();
  return (
    <div ref={ref} className="relative">
      <ToolbarButton
        title={t(locale, 'insertLink')}
        active={active}
        onClick={onToggle}
      >
        <LinkIcon size={18} />
      </ToolbarButton>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={onClose}
          className="rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className={`h-8 w-64 rounded-md border px-2 text-sm outline-none focus:border-blue-400 ${
                url.trim() !== '' && !valid
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200'
              }`}
              placeholder="https://example.com"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) onCommit();
                if (e.key === 'Escape') onClose();
              }}
            />
            <button
              type="button"
              disabled={url.trim() !== '' && !valid}
              className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onCommit}
            >
              Apply
            </button>
            <ToolbarButton title={t(locale, 'close')} onClick={onClose}>
              <X size={18} />
            </ToolbarButton>
          </div>
          {url.trim() !== '' && !valid && (
            <p className="mt-1 text-xs text-red-500">
              {t(locale, 'invalidUrl')}
            </p>
          )}
        </ToolbarPopup>
      )}
    </div>
  );
});
