import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';

interface ImageViewerProps {
  /** 当前要查看的图片地址 */
  src: string;
  /** 可导航图片列表（含当前图） */
  srcs: string[];
  onClose: () => void;
}

/**
 * 图片全屏查看器（Lightbox）。
 * 支持：放大 / 缩小（按钮、滚轮、+/- 键）、上一张 / 下一张（按钮、方向键）、
 * 自适应 / 原始比例切换、重置缩放、Esc 或点击遮罩关闭。
 */
export function ImageViewer({
  src,
  srcs,
  onClose,
}: ImageViewerProps): JSX.Element | null {
  const locale = useLocale();
  const [list] = useState<string[]>(srcs);
  const [index, setIndex] = useState(() => Math.max(0, srcs.indexOf(src)));
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);

  const current = list[index] ?? src;

  // 向前后移动索引（索引越界时自动环绕），并恢复默认缩放
  const move = useCallback(
    (dir: 1 | -1) => {
      setIndex((prev) => {
        if (list.length === 0) return prev;
        return (prev + dir + list.length) % list.length;
      });
      setScale(1);
      setFit(true);
    },
    [list.length],
  );

  // 缩放控制：fit 表示自适应容器；否则按 scale 显示原始比例
  const zoomIn = useCallback(() => {
    setFit(false);
    setScale((s) => Math.min(s * 1.25, 10));
  }, []);

  const zoomOut = useCallback(() => {
    setFit(false);
    setScale((s) => Math.max(s / 1.25, 0.1));
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setFit(true);
  }, []);

  const toggleFit = useCallback(() => {
    setFit((f) => !f);
  }, []);

  // 键盘快捷键：方向键切换图片、+/- 缩放、0/R 重置、Esc 关闭
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          move(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          move(1);
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
        case 'r':
        case 'R':
          reset();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, zoomIn, zoomOut, reset, onClose]);

  // 滚轮缩放：向上滚动放大、向下滚动缩小，并立即退出"自适应"模式
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setFit(false);
    setScale((s) =>
      Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 10),
    );
  }, []);

  if (!list.length) return null;

  const toolbarBtn =
    'rounded-md p-2 text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40';

  // 棋盘格背景：半透明图层（如 PNG 透明区域 / 浅色照片）用浅色格子衬托，
  // 黑色容易被"看透"而分不清图片边缘，浅色棋盘格是查看透明图的通用底
  const checkerboardStyle: React.CSSProperties = {
    backgroundColor: '#f0f0f0',
    backgroundImage:
      'linear-gradient(45deg, #d9d9d9 25%, transparent 25%),' +
      'linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),' +
      'linear-gradient(45deg, transparent 75%, #d9d9d9 75%),' +
      'linear-gradient(-45deg, transparent 75%, #d9d9d9 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={checkerboardStyle}
    >
      {/* 顶部工具栏：关闭 + 位置指示 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-sm text-gray-600 backdrop-blur">
          {index + 1} / {list.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-gray-600 transition-colors hover:bg-black/5 hover:text-gray-900"
          aria-label={t(locale, 'close')}
        >
          <X size={22} />
        </button>
      </div>

      {/* 图片主体：flex 居中，fit 时限定在容器内；点击遮罩关闭、滚轮缩放 */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 遮罩点击关闭由 Esc/X 按钮承担等效键盘操作 */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          key={current}
          src={current}
          alt={t(locale, 'imagePreview')}
          className={fit ? 'max-h-full max-w-full' : ''}
          style={{
            transform: fit ? undefined : `scale(${scale})`,
            userSelect: 'none',
          }}
          draggable={false}
        />
      </div>

      {/* 底部半透明工具栏：上一张 / 缩放 / 重置 / 自适应 / 下一张 */}
      <div className="flex items-center justify-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1.5 backdrop-blur">
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => move(-1)}
            disabled={list.length <= 1}
            aria-label={t(locale, 'imagePrev')}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => move(1)}
            disabled={list.length <= 1}
            aria-label={t(locale, 'imageNext')}
          >
            <ChevronRight size={20} />
          </button>
          <span className="mx-1 h-5 w-px bg-gray-300" />
          <button
            type="button"
            className={toolbarBtn}
            onClick={zoomOut}
            aria-label={t(locale, 'zoomOut')}
          >
            <ZoomOut size={20} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={zoomIn}
            aria-label={t(locale, 'zoomIn')}
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={toggleFit}
            aria-label={t(locale, 'fit')}
          >
            {fit ? <Maximize size={20} /> : <Minimize size={20} />}
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={reset}
            aria-label={t(locale, 'reset')}
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
