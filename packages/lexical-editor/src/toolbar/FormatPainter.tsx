import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { Paintbrush } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import { ToolbarButton } from './ToolbarButton';

/** 一次格式刷操作需要复制的格式：文本位掩码 + 内联样式字符串 */
interface CapturedFormat {
  format: number;
  style: string;
}

/**
 * 格式刷：从当前选区复制文本格式（粗体/斜体等位掩码）与内联样式（字号/颜色等），
 * 用户随后勾选目标文本即可一次性套用。
 *
 * 核心思路（参考 ca/lexical/packages/lib）：
 * 1. 点击按钮时从编辑器当前选区读取格式快照——按钮 onMouseDown preventDefault
 *    避免编辑器失焦，从而能拿到源选区。
 * 2. 在编辑器根元素上挂一次性 mouseup 监听，延迟绑定以免本次点击被误触发。
 * 3. 用户完成勾选（mouseup）后，用 extract() 按选区边界切断 TextNode，
 *    仅对高亮区域内的文本节点 setFormat / setStyle 套用格式，随后自动取消激活。
 */
export const FormatPainter = memo(function FormatPainter() {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const capturedRef = useRef<CapturedFormat | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const mouseUpHandlerRef = useRef<(() => void) | null>(null);

  const deactivate = useCallback(() => {
    const root = rootRef.current;
    const handler = mouseUpHandlerRef.current;
    if (root && handler) {
      root.removeEventListener('mouseup', handler);
    }
    mouseUpHandlerRef.current = null;
    rootRef.current = null;
    capturedRef.current = null;
    activeRef.current = false;
    setActive(false);
  }, []);

  // 组件卸载时兜底清理挂载的监听器，避免内存泄漏
  useEffect(() => deactivate, [deactivate]);

  /** 将已复制的格式套用到当前选区内的文本节点 */
  const applyFormatToSelection = useCallback(
    (format: CapturedFormat) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
        // extract() 会按选区边界切断 TextNode，保证只命中用户高亮区域
        for (const node of selection.extract()) {
          if ($isTextNode(node)) {
            node.setFormat(format.format);
            node.setStyle(format.style);
          }
        }
      });
    },
    [editor],
  );

  const activate = useCallback(() => {
    // 从编辑器当前状态读取源选区的格式与样式快照
    const captured: CapturedFormat = { format: 0, style: '' };
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const firstTextNode = selection.getNodes().find($isTextNode);
      captured.format = selection.format;
      captured.style = firstTextNode ? firstTextNode.getStyle() : '';
    });

    capturedRef.current = captured;
    activeRef.current = true;
    setActive(true);

    const rootElement = editor.getRootElement();
    if (!rootElement) return;
    rootRef.current = rootElement;

    // 就地应用：用户完成勾选（mouseup）后套用格式并取消激活
    const applyOnMouseUp = () => {
      // 延迟到浏览器刷新下一次选区后再读取，确保拿到的是新勾选的选区
      setTimeout(() => {
        const cap = capturedRef.current;
        if (cap) applyFormatToSelection(cap);
        deactivate();
      }, 50);
    };
    mouseUpHandlerRef.current = applyOnMouseUp;

    // 延迟绑定监听，避免本次点击“刷子”按钮的 mouseup 被误触发
    setTimeout(() => {
      if (!activeRef.current) return;
      rootElement.addEventListener('mouseup', applyOnMouseUp);
    }, 100);
  }, [editor, applyFormatToSelection, deactivate]);

  const handleToggle = useCallback(() => {
    if (activeRef.current) {
      deactivate();
    } else {
      activate();
    }
  }, [activate, deactivate]);

  return (
    <ToolbarButton
      title={t(locale, 'formatPainter')}
      active={active}
      onClick={handleToggle}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Paintbrush size={18} />
    </ToolbarButton>
  );
});
