import { Link as LinkIcon, X } from 'lucide-react';
import { useRef } from 'react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopup } from './ToolbarPopup';

interface LinkGroupProps {
  active: boolean;
  open: boolean;
  url: string;
  onToggle: () => void;
  onUrlChange: (url: string) => void;
  onCommit: () => void;
  onClose: () => void;
}

export function LinkGroup({
  active,
  open,
  url,
  onToggle,
  onUrlChange,
  onCommit,
  onClose,
}: LinkGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="relative">
      <ToolbarButton title="Insert link" active={active} onClick={onToggle}>
        <LinkIcon size={18} />
      </ToolbarButton>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={onClose}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          <input
            autoFocus
            className="h-8 w-64 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-blue-400"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommit();
              if (e.key === 'Escape') onClose();
            }}
          />
          <button
            type="button"
            className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            onClick={onCommit}
          >
            Apply
          </button>
          <ToolbarButton title="Close" onClick={onClose}>
            <X size={18} />
          </ToolbarButton>
        </ToolbarPopup>
      )}
    </div>
  );
}
