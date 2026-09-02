import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  type NodeKey,
  isDOMNode,
} from 'lexical';
import {
  type CSSProperties,
  Children,
  type JSX,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

/** 节点尺寸：像素值或继承内容自然尺寸 */
export type Dimension = number | 'inherit';

/** 8 个缩放手柄方向：4 角 + 4 边中点 */
type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 拖拽手柄对应的光标样式 */
const HANDLE_CURSORS: Record<HandleDir, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

/** 手柄在容器上的绝对定位 */
const HANDLE_POS: Record<HandleDir, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  ne: 'left-full top-0 -translate-x-1/2 -translate-y-1/2',
  e: 'left-full top-1/2 -translate-x-1/2 -translate-y-1/2',
  se: 'left-full top-full -translate-x-1/2 -translate-y-1/2',
  s: 'left-1/2 top-full -translate-x-1/2 -translate-y-1/2',
  sw: 'left-0 top-full -translate-x-1/2 -translate-y-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
};

const HANDLES = Object.keys(HANDLE_CURSORS) as HandleDir[];
const MIN_SIZE = 20;

interface Size {
  width: number;
  height: number;
}

interface ResizableContainerProps {
  /** 所属节点的 key，用于选中态与拖拽结束后写回 */
  nodeKey: NodeKey;
  /** 初始宽度；'inherit' 表示跟随内容自然尺寸 */
  width: Dimension;
  /** 初始高度；'inherit' 表示跟随内容自然尺寸 */
  height: Dimension;
  /** 拖拽结束后提交最终尺寸（仅尺寸变化时回调） */
  onResizeEnd: (width: number, height: number) => void;
  containerClassName?: string;
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** 选中且可编辑时渲染的覆盖层（如编辑按钮） */
  renderOverlay?: (interactive: boolean) => ReactNode;
  /** 单个内容元素；缩放时通过 style 注入宽高 */
  children: ReactNode;
}

/**
 * 可缩放节点容器：点击选中后显示蓝色边框与 8 个缩放手柄
 * （4 角双向拉伸 + 4 边中点单向拉伸），拖拽实时预览，松开后
 * 通过 onResizeEnd 提交。内容由 ResizeObserver 测量自然尺寸，
 * 未显式设置宽高时手柄同样立即可用。
 */
export function ResizableContainer({
  nodeKey,
  width,
  height,
  onResizeEnd,
  containerClassName = '',
  onKeyDown,
  renderOverlay,
  children,
}: ResizableContainerProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const [resizing, setResizing] = useState(false);
  const [preview, setPreview] = useState<Size | undefined>(undefined);
  const [measured, setMeasured] = useState<Size | undefined>(undefined);

  const explicitWidth = typeof width === 'number' ? width : undefined;
  const explicitHeight = typeof height === 'number' ? height : undefined;

  // 测量内容自然尺寸，'inherit' 时手柄拖拽的起始尺寸来源
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 1 && rect.height >= 1) {
        setMeasured({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const currentSize: Size | undefined =
    preview ??
    (explicitWidth !== undefined && explicitHeight !== undefined
      ? { width: explicitWidth, height: explicitHeight }
      : measured);

  // 镜像到 ref，供拖拽回调读取最新值
  const sizeRef = useRef<Size | undefined>(currentSize);
  sizeRef.current = currentSize;
  const previewRef = useRef<Size | undefined>(preview);
  previewRef.current = preview;

  // 点击内容选中 / 取消选中；点击手柄不改变选中状态（避免拖拽结束后取消选中）
  useEffect(() => {
    if (!isEditable) {
      if (isSelected) clearSelection();
      return;
    }
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const container = containerRef.current;
          if (!container || !isDOMNode(event.target)) return false;
          if (!container.contains(event.target)) return false;
          if ((event.target as HTMLElement).closest('[data-resize-handle]')) {
            return true;
          }
          if (!event.shiftKey) clearSelection();
          setSelected(!isSelected);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [clearSelection, editor, isSelected, setSelected, isEditable]);

  const startResize = useCallback(
    (dir: HandleDir, e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const start = sizeRef.current;
      if (!start) return;
      const startX = e.clientX;
      const startY = e.clientY;
      setResizing(true);

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let w = start.width;
        let h = start.height;
        // 角点双向拉伸，边中点单向拉伸
        if (dir.includes('e')) w = start.width + dx;
        if (dir.includes('w')) w = start.width - dx;
        if (dir.includes('s')) h = start.height + dy;
        if (dir.includes('n')) h = start.height - dy;
        setPreview({
          width: Math.max(MIN_SIZE, Math.round(w)),
          height: Math.max(MIN_SIZE, Math.round(h)),
        });
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        setResizing(false);
        const final = previewRef.current ?? start;
        setPreview(undefined);
        if (final.width !== start.width || final.height !== start.height) {
          onResizeEnd(final.width, final.height);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [onResizeEnd],
  );

  // 缩放时通过 style 注入预览尺寸；未缩放时应用显式尺寸
  const sizeStyle: CSSProperties = preview ?? {
    width: explicitWidth,
    height: explicitHeight,
  };
  const child = Children.only(children) as ReactElement<{
    style?: CSSProperties;
    ref?: Ref<HTMLElement>;
  }>;
  const sizedChild = cloneElement(child, {
    style: { ...child.props.style, ...sizeStyle },
    ref: contentRef,
  });

  const interactive = isSelected && isEditable;

  return (
    <div
      ref={containerRef}
      onKeyDown={onKeyDown}
      className={`relative inline-block max-w-full select-none ${containerClassName} ${
        interactive ? 'outline outline-blue-500' : ''
      }`}
    >
      {sizedChild}
      {renderOverlay?.(interactive)}
      {/* 拖拽中显示当前尺寸 */}
      {resizing && currentSize && (
        <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-gray-900 px-1.5 py-0.5 text-xs whitespace-nowrap text-white">
          {currentSize.width} × {currentSize.height}
        </div>
      )}
      {/* 8 个缩放手柄 */}
      {interactive &&
        currentSize &&
        HANDLES.map((dir) => (
          <div
            key={dir}
            data-resize-handle={dir}
            onMouseDown={(e) => startResize(dir, e)}
            style={{ cursor: HANDLE_CURSORS[dir] }}
            className={`absolute ${HANDLE_POS[dir]} z-10 h-2.5 w-2.5 rounded-sm border border-white bg-blue-500 shadow-sm hover:scale-125`}
          />
        ))}
    </div>
  );
}
