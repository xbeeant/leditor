import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../context';
import { FullscreenIcon } from '../embed';
import { t } from '../i18n';

/** 模态框尺寸配置 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 模态框标题 */
  title: string;
  /** 模态框内容 */
  children: ReactNode;
  /** 模态框尺寸 */
  size?: ModalSize;
  /** 是否显示全屏按钮 */
  showFullscreen?: boolean;
  /** 是否显示默认关闭按钮 */
  showCloseButton?: boolean;
  /** 自定义宽度（优先级高于 size） */
  customWidth?: string;
  /** 自定义头部右侧区域 */
  headerActions?: ReactNode;
  /** 底部区域 */
  footer?: ReactNode;
  /** 定位方式 */
  position?: 'center' | 'custom';
  /** 自定义样式（position="custom" 时使用） */
  customStyle?: React.CSSProperties;
  /** 内部容器 ref（用于定位计算） */
  innerRef?: React.Ref<HTMLDivElement>;
}

/** 根据尺寸返回对应的 Tailwind 类名 */
function getSizeClasses(size: ModalSize, fullscreen: boolean): string {
  if (fullscreen) {
    return 'h-screen w-screen rounded-none';
  }

  const sizeMap: Record<ModalSize, string> = {
    sm: 'w-96',
    md: 'w-[28rem]',
    lg: 'h-[85vh] w-[90vw] max-w-6xl',
    xl: 'h-[90vh] w-[95vw]',
    full: 'h-[85vh] w-[90vw] max-w-6xl',
  };

  return sizeMap[size] || sizeMap.lg;
}

/**
 * 公共模态框组件。
 * 支持全屏/还原切换、portal 渲染。
 * 支持自定义定位（用于基于光标位置的模态框）。
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'lg',
  showFullscreen = true,
  showCloseButton = true,
  headerActions,
  footer,
  position = 'center',
  customStyle,
  innerRef,
}: ModalProps): ReturnType<typeof createPortal> | null {
  const locale = useLocale();
  const [fullscreen, setFullscreen] = useState(false);

  if (!open) return null;

  const renderHeader = () => (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <div className="flex items-center gap-1">
        {headerActions}
        {showFullscreen && (
          <button
            type="button"
            title={fullscreen ? t(locale, 'restore') : t(locale, 'fullscreen')}
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
          >
            <FullscreenIcon fullscreen={fullscreen} />
          </button>
        )}
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            {t(locale, 'close')}
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(
    position === 'center' ? (
      <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/40">
        <div
          ref={innerRef}
          className={`flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${getSizeClasses(
            size,
            fullscreen,
          )}`}
        >
          {renderHeader()}
          <div className="flex-1 overflow-hidden">{children}</div>
          {footer && (
            <div className="border-t border-gray-200 px-4 py-3">{footer}</div>
          )}
        </div>
      </div>
    ) : (
      <>
        <div className="fixed inset-0 z-90" onClick={onClose} />
        <div
          ref={innerRef}
          style={customStyle}
          className="flex flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        >
          {renderHeader()}
          <div className="flex-1 overflow-hidden">{children}</div>
          {footer && (
            <div className="border-t border-gray-200 px-4 py-3">{footer}</div>
          )}
        </div>
      </>
    ),
    document.body,
  );
}
