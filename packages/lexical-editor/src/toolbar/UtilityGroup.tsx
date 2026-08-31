import {
  Eye,
  EyeOff,
  Globe,
  List,
  MessageSquare,
  MessageSquarePlus,
} from 'lucide-react';
import type { Locale } from '../i18n';
import { t } from '../i18n';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';

/**
 * 工具栏右侧功能按钮组：评论、目录固定、语言切换、只读切换。
 * 将原本散落在 Toolbar 主组件内的 5 个原始 <button> 收拢为独立 Group，
 * 复用 ToolbarButton 统一样式，并通过 i18n 消除硬编码的英文标题。
 */
interface UtilityGroupProps {
  toc?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  showComments?: boolean;
  onToggleComments?: () => void;
  onAddComment?: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
}

export function UtilityGroup({
  toc,
  pinned,
  onTogglePin,
  showComments,
  onToggleComments,
  onAddComment,
  locale,
  onLocaleChange,
  readOnly,
  onReadOnlyChange,
}: UtilityGroupProps) {
  return (
    <div className="ml-auto flex items-center gap-1">
      {/* 添加评论 */}
      <ToolbarButton title={t(locale, 'addComment')} onClick={onAddComment}>
        <MessageSquarePlus size={18} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* 评论面板显隐开关 */}
      <ToolbarButton
        title={t(locale, 'toggleComments')}
        active={showComments}
        onClick={onToggleComments}
      >
        <MessageSquare size={18} />
      </ToolbarButton>

      {/* 目录固定开关（仅启用 toc 时显示） */}
      {toc && (
        <ToolbarButton
          title={t(locale, 'toggleToc')}
          active={pinned}
          onClick={onTogglePin}
        >
          <List size={18} />
        </ToolbarButton>
      )}

      <ToolbarDivider />

      {/* 语言切换：显示当前语言名称 */}
      <button
        type="button"
        onClick={() => onLocaleChange(locale === 'zh-CN' ? 'en' : 'zh-CN')}
        className="inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-xs text-gray-700 hover:bg-gray-100"
        title={t(locale, 'language')}
      >
        <Globe size={16} />
        <span>{locale === 'zh-CN' ? '中文' : 'English'}</span>
      </button>

      <ToolbarDivider />

      {/* 只读 / 编辑模式切换 */}
      <ToolbarButton
        title={t(locale, readOnly ? 'editable' : 'readOnly')}
        active={readOnly}
        onClick={() => onReadOnlyChange(!readOnly)}
      >
        {readOnly ? <EyeOff size={18} /> : <Eye size={18} />}
      </ToolbarButton>
    </div>
  );
}
