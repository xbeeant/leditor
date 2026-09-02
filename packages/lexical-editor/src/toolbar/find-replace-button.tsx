import { Search } from 'lucide-react';
import { useLocale } from '../context';
import { t } from '../i18n';
import { ToolbarButton } from './toolbar-button';

interface FindReplaceButtonProps {
  onToggle: () => void;
}

/** 查找与替换工具栏按钮：点击打开查找浮窗 */
export function FindReplaceButton({ onToggle }: FindReplaceButtonProps) {
  const locale = useLocale();
  return (
    <ToolbarButton title={t(locale, 'findReplace')} onClick={onToggle}>
      <Search size={18} />
    </ToolbarButton>
  );
}
