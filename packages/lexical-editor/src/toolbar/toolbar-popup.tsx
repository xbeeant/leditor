import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface ToolbarPopupProps {
  /** 触发按钮的容器 ref，用于计算弹层位置 */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** start: 弹层左边缘对齐按钮；end: 右边缘对齐 */
  align?: 'start' | 'end';
  offsetY?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * 通过 portal 渲染到 document.body 的工具栏弹层（fixed 定位），
 * 避免被 Toolbar 的 overflow-x-auto 容器裁剪。
 * 自动避让视口边界（上下翻转、左右收缩），点击外部 / Escape 关闭。
 */
export function ToolbarPopup({
  anchorRef,
  open,
  onClose,
  align = 'start',
  offsetY = 6,
  className,
  children,
}: ToolbarPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = popup?.offsetWidth ?? 0;
    const height = popup?.offsetHeight ?? 0;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.min(Math.max(8, left), Math.max(8, viewportW - width - 8));

    let top = rect.bottom + offsetY;
    if (top + height > viewportH - 8 && rect.top - offsetY - height > 8) {
      // 下方空间不足且上方够用，向上弹出
      top = rect.top - offsetY - height;
    }
    top = Math.max(8, top);

    setPos((prev) =>
      prev && prev.top === top && prev.left === left ? prev : { top, left },
    );
  }, [anchorRef, align, offsetY]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  // 首次渲染后测量实际宽高，校正最终位置
  useLayoutEffect(() => {
    if (!open || pos === null) return;
    updatePosition();
  }, [open, pos, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popupRef}
      className={className}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 100,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
