import { defineExtension } from 'lexical';

// 与 theme.ts 中 tableScrollableWrapper 的标记类保持一致
const SCROLLABLE_WRAPPER_CLASS = 'lexical-table-scrollable-wrapper';
const HAS_SCROLL_RIGHT_CLASS = 'lexical-table-scroll-right';
const HAS_SCROLL_LEFT_CLASS = 'lexical-table-scroll-left';
const HAS_SCROLL_MIDDLE_CLASS = 'lexical-table-scroll-middle';

function updateTableScrollState(element: HTMLElement): void {
  const hasScroll = element.scrollWidth > element.clientWidth;
  // ±1 容差避免浮点精度导致误判
  const isScrolledToRight =
    element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
  const isScrolledToLeft = element.scrollLeft <= 1;

  element.classList.remove(HAS_SCROLL_RIGHT_CLASS);
  element.classList.remove(HAS_SCROLL_LEFT_CLASS);
  element.classList.remove(HAS_SCROLL_MIDDLE_CLASS);

  if (hasScroll) {
    // 中间态：两端都未到达
    if (!isScrolledToLeft && !isScrolledToRight) {
      element.classList.add(HAS_SCROLL_MIDDLE_CLASS);
    } else if (isScrolledToLeft && !isScrolledToRight) {
      element.classList.add(HAS_SCROLL_RIGHT_CLASS);
    } else if (!isScrolledToLeft && isScrolledToRight) {
      element.classList.add(HAS_SCROLL_LEFT_CLASS);
    }
  }
}

function findWrappers(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`.${SCROLLABLE_WRAPPER_CLASS}`),
  );
}

/**
 * 宽表格滚动阴影扩展：为可横向滚动的表格容器动态添加左右滚动状态类，
 * 配合 CSS 在左右边缘显示阴影指示，提示用户还有更多列。
 */
export const TableScrollShadowExtension = defineExtension({
  name: '@leditor/table-scroll-shadow',
  register(editor) {
    const editorElement = editor.getRootElement();
    if (!editorElement) return () => {};

    const scrollHandlers = new Map<HTMLElement, () => void>();
    const observed = new Set<HTMLElement>();
    const resizeObserver = new ResizeObserver(() => {
      findWrappers(editorElement).forEach(updateTableScrollState);
    });

    const addScrollListener = (wrapper: HTMLElement) => {
      if (scrollHandlers.has(wrapper)) return;
      const handler = () => updateTableScrollState(wrapper);
      wrapper.addEventListener('scroll', handler, { passive: true });
      scrollHandlers.set(wrapper, handler);
    };

    const observeWrapper = (wrapper: HTMLElement) => {
      if (observed.has(wrapper)) return;
      observed.add(wrapper);
      resizeObserver.observe(wrapper);
      addScrollListener(wrapper);
      updateTableScrollState(wrapper);
    };

    // 初始注入
    findWrappers(editorElement).forEach(observeWrapper);

    // 监听后续新增的表格容器
    const mutationObserver = new MutationObserver(() => {
      findWrappers(editorElement).forEach(observeWrapper);
    });
    mutationObserver.observe(editorElement, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollHandlers.forEach((handler, wrapper) => {
        wrapper.removeEventListener('scroll', handler);
      });
      scrollHandlers.clear();
    };
  },
});
