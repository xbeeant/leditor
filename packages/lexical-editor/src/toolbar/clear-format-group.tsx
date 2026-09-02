import { Eraser } from 'lucide-react';
import { memo } from 'react';
import { useLocale } from '../context';
import { t } from '../i18n';
import { ToolbarButton } from './toolbar-button';

interface ClearFormatGroupProps {
  onClear: () => void;
}

export const ClearFormatGroup = memo(function ClearFormatGroup({
  onClear,
}: ClearFormatGroupProps) {
  const locale = useLocale();
  return (
    <ToolbarButton title={t(locale, 'clearFormat')} onClick={onClear}>
      <Eraser size={18} />
    </ToolbarButton>
  );
});
