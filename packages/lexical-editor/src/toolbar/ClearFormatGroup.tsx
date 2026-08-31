import { Eraser } from 'lucide-react';
import { memo } from 'react';
import { t } from '../i18n';
import { useLocale } from '../LocaleContext';
import { ToolbarButton } from './ToolbarButton';

interface ClearFormatGroupProps {
  onClear: () => void;
}

export const ClearFormatGroup = memo(function ClearFormatGroup({ onClear }: ClearFormatGroupProps) {
  const locale = useLocale();
  return (
    <ToolbarButton title={t(locale, 'clearFormat')} onClick={onClear}>
      <Eraser size={18} />
    </ToolbarButton>
  );
});
