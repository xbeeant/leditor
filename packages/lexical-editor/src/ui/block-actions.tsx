import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  type ElementNode,
  type LexicalEditor,
} from 'lexical';
import { GripVertical, Plus } from 'lucide-react';
import {
  type JSX,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocale } from '../context';
import { t } from '../i18n';

const INDICATOR_WIDTH = 2;

type MenuState = {
  left: number;
  top: number;
  blockKey: string;
};

type DropState = {
  top: number;
  targetKey: string;
  before: boolean;
};

/** 解析 DOM 节点所处的顶级块元素节点。 */
function getTopLevelElementFromDOM(
  dom: HTMLElement,
  editor: LexicalEditor,
): ElementNode | null {
  return editor.getEditorState().read(
    () => {
      const nearest = $getNearestNodeFromDOMNode(dom);
      const top = nearest ? nearest.getTopLevelElement() : null;
      return $isElementNode(top) ? top : null;
    },
    { editor },
  );
}

export function FloatingBlockActionsPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const locale = useLocale();

  const hoveredBlockKeyRef = useRef<string | null>(null);
  const menuRef = useRef<MenuState | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ blockKey: string } | null>(null);
  const dropRef = useRef<DropState | null>(null);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);

  // 悬停显示左侧操作把手。
  useEffect(() => {
    const hide = () => {
      hoveredBlockKeyRef.current = null;
      menuRef.current = null;
      setMenu(null);
    };
    const clampLeft = (rect: DOMRect, width: number, root: HTMLElement) => {
      const rootLeft = root.getBoundingClientRect().left;
      // 用实际渲染宽度计算：把手右缘与文本保持 8px 间距，左缘最多贴齐 ContentEditable 左缘，
      // 完全落在 ContentEditable 自带的左侧 padding gutter 内，避免遮挡文本。
      const w = barRef.current?.offsetWidth || width;
      const byBlock = rect.left - w - 8;
      return Math.min(Math.max(byBlock, rootLeft), window.innerWidth - w - 8);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (dragRef.current) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest('[data-block-actions-bar], [data-block-drop-indicator]')
      ) {
        return;
      }
      const targetEl = target instanceof HTMLElement ? target : null;
      const root = editor.getRootElement();

      // 鼠标在操作把手自身或其附近时保持显示，避免「移向把手途中把手消失」。
      const nearBar = () => {
        const barEl = barRef.current;
        if (!barEl) {
          return false;
        }
        const r = barEl.getBoundingClientRect();
        const pad = 12;
        return (
          event.clientX >= r.left - pad &&
          event.clientX <= r.right + pad &&
          event.clientY >= r.top - pad &&
          event.clientY <= r.bottom + pad
        );
      };

      if (!targetEl || !root || !root.contains(targetEl)) {
        // 离开编辑区后保留一段缓冲距离，方便把鼠标移向把手。
        if (menuRef.current && root) {
          const rect = root.getBoundingClientRect();
          if (
            event.clientX >= rect.left - 24 &&
            event.clientX <= rect.right + 24 &&
            event.clientY >= rect.top - 24 &&
            event.clientY <= rect.bottom + 24
          ) {
            return;
          }
        }
        if (menuRef.current && !nearBar()) {
          hide();
        }
        return;
      }

      const block = getTopLevelElementFromDOM(targetEl, editor);
      if (!block || block.getKey() === 'root') {
        // 鼠标落在块间空隙或把手右侧的 gutter 区，只要还在把手附近就不隐藏。
        if (menuRef.current && !nearBar()) {
          hide();
        }
        return;
      }

      const blockEl = editor.getElementByKey(block.getKey());
      if (!blockEl) {
        return;
      }
      const rect = blockEl.getBoundingClientRect();
      const next = {
        left: clampLeft(rect, 48, root),
        top: rect.top + rect.height / 2,
        blockKey: block.getKey(),
      };
      const changed =
        !menuRef.current ||
        menuRef.current.left !== next.left ||
        menuRef.current.top !== next.top ||
        menuRef.current.blockKey !== next.blockKey;
      if (changed) {
        menuRef.current = next;
        setMenu(next);
      }
      hoveredBlockKeyRef.current = block.getKey();
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [editor]);

  // 拖拽重排：原生 pointer 事件计算放置位置。
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const root = editor.getRootElement();
      if (!root) {
        return;
      }
      const siblings = editor.getEditorState().read(
        () => {
          const from = $getNodeByKey(drag.blockKey)?.getTopLevelElement();
          if (!from) {
            return [] as { key: string; el: HTMLElement }[];
          }
          const parent = from.getParent();
          if (!parent) {
            return [];
          }
          const list: { key: string; el: HTMLElement }[] = [];
          for (const child of parent.getChildren()) {
            const el = editor.getElementByKey(child.getKey());
            if (el) {
              list.push({ key: child.getKey(), el });
            }
          }
          return list;
        },
        { editor },
      );

      let targetKey: string | null = null;
      let before = false;
      for (const s of siblings) {
        const r = s.el.getBoundingClientRect();
        if (event.clientY >= r.top && event.clientY <= r.bottom) {
          targetKey = s.key;
          before = event.clientY < r.top + r.height / 2;
          break;
        }
      }

      const next: DropState | null = targetKey
        ? {
            top: before
              ? (getRect(targetKey)?.top ?? 0)
              : (getRect(targetKey)?.bottom ?? 0),
            targetKey,
            before,
          }
        : null;
      dropRef.current = next;
      setDrop(next);
    };

    function getRect(key: string): DOMRect | null {
      return editor.getElementByKey(key)?.getBoundingClientRect() ?? null;
    }

    const finishDrag = () => {
      const drag = dragRef.current;
      const dropState = dropRef.current;
      dragRef.current = null;
      dropRef.current = null;
      setDrop(null);
      if (!drag || !dropState || drag.blockKey === dropState.targetKey) {
        return;
      }
      const fromKey = drag.blockKey;
      const targetKey = dropState.targetKey;
      editor.update(() => {
        const from = $getNodeByKey(fromKey)?.getTopLevelElement();
        const to = $getNodeByKey(targetKey)?.getTopLevelElement();
        if (
          !from ||
          !to ||
          from === to ||
          from.getParent() !== to.getParent()
        ) {
          return;
        }
        if (dropState.before) {
          to.insertBefore(from);
        } else {
          to.insertAfter(from);
        }
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          from.selectStart();
        }
      });
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', finishDrag);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
    };
  }, [editor]);

  if (!isEditable) {
    return null;
  }

  const handleInsertBelow = () => {
    const blockKey = menuRef.current?.blockKey ?? hoveredBlockKeyRef.current;
    if (!blockKey) {
      return;
    }
    editor.update(() => {
      const top = $getNodeByKey(blockKey)?.getTopLevelElement();
      if (!top) {
        return;
      }
      const paragraph = $createParagraphNode();
      top.insertAfter(paragraph);
      paragraph.select();
    });
  };

  const handleDragStart = (event: ReactPointerEvent) => {
    event.preventDefault();
    const key = menuRef.current?.blockKey ?? hoveredBlockKeyRef.current;
    if (!key) {
      return;
    }
    dragRef.current = { blockKey: key };
  };

  const handleClass =
    'flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900';

  const isDragging = dragRef.current?.blockKey === menu?.blockKey;

  return (
    <>
      {menu && (
        <div
          ref={barRef}
          data-block-actions-bar
          className="fixed z-50 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-gray-200 bg-white/95 p-0.5 shadow-sm backdrop-blur"
          style={{ left: menu.left, top: menu.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            title={t(locale, 'insertBelow')}
            className={handleClass}
            onClick={handleInsertBelow}
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            title={t(locale, 'dragToMove')}
            className={`${handleClass} cursor-grab ${
              isDragging ? 'text-gray-900' : ''
            }`}
            onPointerDown={handleDragStart}
          >
            <GripVertical size={14} />
          </button>
        </div>
      )}
      {drop && (
        <div
          data-block-drop-indicator
          className="pointer-events-none fixed z-50 flex items-center"
          style={{ top: drop.top - INDICATOR_WIDTH / 2, left: 8 }}
        >
          <div
            className="rounded-full"
            style={{
              width: window.innerWidth - 16,
              height: INDICATOR_WIDTH,
              backgroundColor: '#3b82f6',
              boxShadow: '0 0 0 1px rgba(59,130,246,0.35)',
            }}
          />
        </div>
      )}
    </>
  );
}
