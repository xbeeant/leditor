import { Languages } from 'lucide-react';
import { memo, useRef, useState } from 'react';
import { t } from '../i18n';
import { useLocale } from '../LocaleContext';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopup } from './ToolbarPopup';

interface RubyGroupProps {
  onInsert: (text: string, annotation: string) => void;
}

export const RubyGroup = memo(function RubyGroup({ onInsert }: RubyGroupProps) {
  const [open, setOpen] = useState(false);
  const [annotation, setAnnotation] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  const handleInsert = () => {
    if (annotation.trim()) {
      onInsert('', annotation.trim());
      setAnnotation('');
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <ToolbarButton title={t(locale, 'rubyAnnotation')} onClick={() => setOpen((v) => !v)}>
        <Languages size={18} />
      </ToolbarButton>

      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={() => setOpen(false)}
          className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 text-xs font-medium text-gray-500">
            {t(locale, 'rubyTip')}
          </div>
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="h-8 flex-1 rounded-md border border-gray-200 px-2 text-sm outline-none focus:border-blue-400"
              placeholder={t(locale, 'rubyPlaceholder')}
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInsert();
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            <button
              type="button"
              disabled={!annotation.trim()}
              className="h-8 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleInsert}
            >
              {t(locale, 'insert')}
            </button>
          </div>
        </ToolbarPopup>
      )}
    </div>
  );
});
