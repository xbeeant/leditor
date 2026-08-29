import { Redo2, Undo2 } from 'lucide-react';
import { t } from '../i18n';
import { useLocale } from '../LocaleContext';
import { ToolbarButton } from './ToolbarButton';

interface HistoryGroupProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function HistoryGroup({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: HistoryGroupProps) {
  const locale = useLocale();
  return (
    <>
      <ToolbarButton title={t(locale, 'undo')} disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={18} />
      </ToolbarButton>
      <ToolbarButton title={t(locale, 'redo')} disabled={!canRedo} onClick={onRedo}>
        <Redo2 size={18} />
      </ToolbarButton>
    </>
  );
}
