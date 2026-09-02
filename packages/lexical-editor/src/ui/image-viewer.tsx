import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../context';
import { t } from '../i18n';

interface ImageViewerProps {
  /** 当前要查看的图片地址 */
  src: string;
  /** 可导航图片列表（含当前图），不传则自动收集 */
  srcs?: string[];
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 将相对路径转为绝对 URL，方便与 DOM 收集到的 absolute URL 进行比较。
 * 例如："/assets/img.png" → "https://example.com/assets/img.png"
 */
function toAbsoluteUrl(url: string): string {
  return new URL(url, window.location.href).href;
}

/**
 * 图片全屏查看器（Lightbox）。
 * 支持：放大 / 缩小（按钮、滚轮、+/- 键）、上一张 / 下一张（按钮、方向键）、
 * 自适应 / 原始比例切换、重置缩放、Esc 或点击遮罩关闭。
 * 挂载时自动收集 DOM 中所有 `<img>` 作为可导航图片列表。
 */
export function ImageViewer({
  src,
  srcs,
  onClose,
}: ImageViewerProps): JSX.Element | null {
  const locale = useLocale();

  // 优先使用传入的 srcs，没有才自动收集 DOM 中的图片
  const images = useMemo(() => {
    if (srcs && srcs.length > 0) return srcs;
    const elements = document.querySelectorAll('[contenteditable="true"]');
    const allImgs: HTMLImageElement[] = [];
    for (const el of elements) {
      allImgs.push(...Array.from(el.querySelectorAll<HTMLImageElement>('img')));
    }
    return allImgs
      .map((img) => img.currentSrc || img.src)
      .filter((s): s is string => Boolean(s) && s !== 'data:,');
  }, [srcs]);

  const [index, setIndex] = useState(() => {
    // 优先尝试匹配绝对 URL（浏览器解析后的 img.src/currentSrc）
    const absolute = toAbsoluteUrl(src);
    const idx = images.indexOf(absolute);
    return idx >= 0 ? idx : 0;
  });
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);
  // 旋转角度（0, 90, 180, 270）
  const [rotation, setRotation] = useState(0);
  // 拖拽状态：仅缩放模式下生效
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const current = images[index] ?? src;

  // 向前后移动索引（索引越界时自动环绕），并恢复默认缩放
  const move = useCallback(
    (dir: 1 | -1) => {
      setIndex((prev) => {
        if (images.length === 0) return prev;
        return (prev + dir + images.length) % images.length;
      });
      setScale(1);
      setFit(true);
    },
    [images.length],
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

  const rotateCW = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const rotateCCW = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setFit(true);
    setRotation(0);
  }, []);

  const toggleFit = useCallback(() => {
    setFit((f) => !f);
  }, []);

  // 键盘快捷键：方向键切换图片、+/- 缩放、Q/E 旋转、0/R 重置、Esc 关闭
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
        case 'e':
        case 'E':
          e.preventDefault();
          rotateCCW();
          break;
        case 'q':
        case 'Q':
          e.preventDefault();
          rotateCW();
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
  }, [move, zoomIn, zoomOut, reset, rotateCCW, rotateCW, onClose]);

  // 滚轮缩放：向上滚动放大、向下滚动缩小，并立即退出"自适应"模式
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setFit(false);
    setScale((s) =>
      Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.1), 10),
    );
  }, []);

  // 拖拽支持：打开预览即可拖拽移动图片
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    },
    [offset],
  );

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // 缩放/重置时重置偏移
  useEffect(() => {
    if (fit || scale === 1) {
      setOffset({ x: 0, y: 0 });
    }
  }, [fit, scale]);

  if (!images.length) return null;

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
      className="fixed inset-0 z-200 flex flex-col"
      style={checkerboardStyle}
    >
      {/* 图片主体：全屏覆盖，点击空白处关闭 */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 遮罩点击关闭由 Esc/X 按钮承担等效键盘操作 */}
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={!fit ? { cursor: isDragging.current ? 'grabbing' : 'grab' } : {}}
        onWheel={onWheel}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
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
            transform: fit
              ? `rotate(${rotation}deg)`
              : `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px) rotate(${rotation}deg)`,
            userSelect: 'none',
            transition: isDragging.current ? 'none' : 'transform 0.15s',
          }}
          draggable={false}
          onMouseDown={onMouseDown}
        />
        {/* 顶部半透明工具栏：悬浮在图片上方 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
          <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-sm text-gray-600 backdrop-blur">
            {index + 1} / {images.length}
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
        {/* 底部半透明工具栏：悬浮在图片上方 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full bg-white/70 px-2 py-1.5 backdrop-blur">
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => move(-1)}
              disabled={images.length <= 1}
              aria-label={t(locale, 'imagePrev')}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => move(1)}
              disabled={images.length <= 1}
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
              onClick={rotateCCW}
              aria-label={t(locale, 'rotateCCW')}
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={rotateCW}
              aria-label={t(locale, 'rotateCW')}
            >
              <RotateCw size={20} />
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={reset}
              aria-label={t(locale, 'reset')}
            >
              <RefreshCcw size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
