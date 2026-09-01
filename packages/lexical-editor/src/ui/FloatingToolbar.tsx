import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $patchStyleText } from '@lexical/selection';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { Brush, Eraser, Link, Link2Off } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import { $isCodeDrawingNode } from '../nodes';
import { $isMermaidNode } from '../nodes';
import { TextFormatGroup } from '../toolbar/TextFormatGroup';
import { ToolbarButton } from '../toolbar/ToolbarButton';
import { ToolbarDivider } from '../toolbar/ToolbarDivider';
import type { TextFormat } from '../toolbar/types';
import { getDOMRangeRect } from '../utils';
import { setFloatingElementPosition } from '../utils';

interface FloatingFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  subscript: boolean;
  superscript: boolean;
  code: boolean;
}

/**
 * 选中文本后显示在选区上方的浮动格式化工具栏。
 * 提供最常用的格式化操作：粗体 / 斜体 / 下划线 / 删除线 / 行内代码、
 * 链接、格式刷与清除格式。不持有选区外的其他状态，保持轻量。
 */
export function FloatingToolbar({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const locale = useLocale();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [formats, setFormats] = useState<FloatingFormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false,
    code: false,
  });
  const [linkActive, setLinkActive] = useState(false);
  const [painterActive, setPainterActive] = useState(false);
  const [visible, setVisible] = useState(false);
  // visible 的同步 ref：供滚动/缩放等事件回调读取最新可见状态，
  // 避免闭包过期值导致已隐藏的工具栏被重新定位并强制显示
  const visibleRef = useRef(false);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // visible 变为 false 时必须重置 transform + 禁用 pointer-events，
  // 否则工具栏会停留在上次定位的位置（虽然 opacity=0 不可见），
  // 但仍有 pointer-events-auto 拦截鼠标事件，导致无法选中文本
  useEffect(() => {
    if (!visible) {
      const toolbarElem = toolbarRef.current;
      if (toolbarElem) {
        setFloatingElementPosition(null, toolbarElem, anchorElem);
      }
    }
  }, [visible, anchorElem]);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // 碰撞检测：定位后若工具栏与绘图块（Mermaid / CodeDrawing）的头部操作栏
  // （以 data-drawing-block-header 标记）重叠，则隐藏工具栏并重置定位样式，
  // 作为兜底手段从根源上避免遮挡块头部的类型下拉框与代码/预览/分栏按钮
  const hideIfOverlappingBlockHeaders = () => {
    const toolbarElem = toolbarRef.current;
    const root = editor.getRootElement();
    if (!toolbarElem || !root) return;
    const toolbarRect = toolbarElem.getBoundingClientRect();
    const headers = root.querySelectorAll('[data-drawing-block-header]');
    for (const header of Array.from(headers)) {
      const rect = header.getBoundingClientRect();
      const overlaps =
        toolbarRect.left < rect.right &&
        toolbarRect.right > rect.left &&
        toolbarRect.top < rect.bottom &&
        toolbarRect.bottom > rect.top;
      if (overlaps) {
        setVisible(false);
        // setFloatingElementPosition 会命令式设置 opacity/transform，
        // 隐藏时需同步重置，避免样式残留导致工具栏继续显示
        setFloatingElementPosition(null, toolbarElem, anchorElem);
        return;
      }
    }
  };

  const $updateToolbar = () => {
    const toolbarElem = toolbarRef.current;
    if (toolbarElem === null || !anchorElem) return;

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setVisible(false);
        return;
      }

      // 选区覆盖 Mermaid / CodeDrawing 块时不显示浮动工具栏，
      // 避免工具栏定位到块头部、遮挡其类型下拉框与代码/预览/分栏按钮
      const containsDrawingBlock = selection.getNodes().some((node) => {
        if ($isMermaidNode(node) || $isCodeDrawingNode(node)) return true;
        return node
          .getParents()
          .some((p) => $isMermaidNode(p) || $isCodeDrawingNode(p));
      });
      if (containsDrawingBlock) {
        setVisible(false);
        return;
      }

      // 焦点位于编辑器内的 textarea（如 Mermaid 代码编辑区）时隐藏浮动工具栏，
      // 此时原生选区在 textarea 中，Lexical 选区可能仍是旧状态，
      // 若继续定位会把工具栏压到 Mermaid 头部、遮挡代码/预览/分栏按钮
      const root = editor.getRootElement();
      const activeEl = document.activeElement;
      if (
        root &&
        activeEl instanceof HTMLTextAreaElement &&
        root.contains(activeEl)
      ) {
        setVisible(false);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const linkParent = anchorNode.getParents().find((n) => $isLinkNode(n));
      setLinkActive(linkParent != null);
      setFormats({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
        strikethrough: selection.hasFormat('strikethrough'),
        subscript: selection.hasFormat('subscript'),
        superscript: selection.hasFormat('superscript'),
        code: selection.hasFormat('code'),
      });
      setVisible(true);

      // 定位浮动工具栏到选区上方
      const nativeSelection = window.getSelection();
      if (nativeSelection && nativeSelection.rangeCount > 0 && root) {
        const rangeRect = getDOMRangeRect(nativeSelection, root);
        setFloatingElementPosition(rangeRect, toolbarElem, anchorElem);
      }

      // 兜底：显示前必做碰撞检测，与绘图块头部重叠（含定位被跳过、
      // 工具栏落在默认/过期位置的情况）则隐藏，避免遮挡块头部操作按钮
      hideIfOverlappingBlockHeaders();
    });
  };

  useEffect(() => {
    // anchorElem 本身即为可滚动的编辑区容器
    const scrollerElem = anchorElem;

    const handleResize = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
        // 工具栏当前隐藏时不重新定位：滚动/缩放路径会经
        // setFloatingElementPosition 强制将 opacity 置 1，导致残留工具栏显现
        if (!visibleRef.current) return;
        const nativeSelection = window.getSelection();
        const root = editor.getRootElement();
        // 焦点在编辑器内的 textarea（如 Mermaid 代码区）或无有效原生选区时
        // 不重新定位，避免滚动/缩放时工具栏被压到 Mermaid 头部遮挡切换按钮
        const activeEl = document.activeElement;
        if (
          !nativeSelection ||
          nativeSelection.rangeCount === 0 ||
          !root ||
          !toolbarRef.current ||
          (activeEl instanceof HTMLTextAreaElement && root.contains(activeEl))
        ) {
          return;
        }
        const rangeRect = getDOMRangeRect(nativeSelection, root);
        setFloatingElementPosition(rangeRect, toolbarRef.current, anchorElem);
        // 兜底：重定位后与绘图块头部重叠则隐藏
        hideIfOverlappingBlockHeaders();
      });
    };

    window.addEventListener('resize', handleResize);
    scrollerElem?.addEventListener('scroll', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      scrollerElem?.removeEventListener('scroll', handleResize);
    };
  }, [editor, anchorElem]);

  useEffect(() => {
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        $updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterUpdate = editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          // 不依赖闭包中的 visible（可能过期），直接隐藏，
          // 避免选区折叠后工具栏残留并遮挡 Mermaid 等块的工具条
          setVisible(false);
          return;
        }
        $updateToolbar();
      });
    });

    return () => {
      unregisterSelection();
      unregisterUpdate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, anchorElem]);

  const clearFormatting = () => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;
      for (const node of sel.extract()) {
        if ($isTextNode(node)) node.setFormat(0);
      }
      $patchStyleText(sel, {
        color: '',
        'background-color': '',
        'font-size': '',
        'font-family': '',
        'font-weight': '',
        'font-style': '',
        'text-decoration': '',
      });
    });
    editor.focus();
  };

  const applyFormat = (format: TextFormat) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (format === 'bold') selection.formatText('bold');
        else if (format === 'italic') selection.formatText('italic');
        else if (format === 'underline') selection.formatText('underline');
        else if (format === 'strikethrough')
          selection.formatText('strikethrough');
        else if (format === 'subscript') selection.formatText('subscript');
        else if (format === 'superscript') selection.formatText('superscript');
        else if (format === 'code') selection.formatText('code');
      }
    });
    editor.focus();
  };

  const toggleLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = selection.anchor.getNode();
      const linkParent = node.getParents().find((n) => $isLinkNode(n));
      if (linkParent) setLinkUrl(linkParent.getURL());
      else setLinkUrl('');
    });
    setLinkEditorOpen((v) => !v);
  };

  const commitLink = () => {
    let finalUrl = linkUrl.trim();
    if (finalUrl === '') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      setLinkEditorOpen(false);
      editor.focus();
      return;
    }
    try {
      new URL(finalUrl);
    } catch {
      try {
        new URL(`https://${finalUrl}`);
        finalUrl = `https://${finalUrl}`;
      } catch {
        return;
      }
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, finalUrl);
    setLinkEditorOpen(false);
    editor.focus();
  };

  const togglePainter = () => {
    setPainterActive((v) => !v);
  };

  if (!isEditable) return null;

  const linkInput = linkEditorOpen ? (
    <div className="flex items-center gap-1 border-l border-gray-200 pl-1">
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitLink();
          }
        }}
        placeholder="https://…"
        className="h-7 w-40 rounded border border-gray-200 px-2 text-xs outline-none focus:border-blue-400"
      />
      <button
        type="button"
        onClick={commitLink}
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
      >
        {t(locale, 'link')}
      </button>
    </div>
  ) : null;

  return createPortal(
    <div
      ref={toolbarRef}
      className={`absolute z-50 flex flex-nowrap items-center gap-0.5 rounded-md border border-gray-200 bg-white p-1 shadow-md ${
        visible ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      style={{ top: 0, left: 0, opacity: visible ? 1 : 0 }}
      // 阻止 mousedown 默认行为，避免点击按钮时编辑器失焦、选区被清除
      onMouseDown={(e) => e.preventDefault()}
    >
      <TextFormatGroup formats={formats} onFormat={applyFormat} />

      <ToolbarDivider />

      <ToolbarButton
        title={t(locale, 'link')}
        active={linkActive}
        onClick={toggleLink}
      >
        {linkActive ? <Link2Off size={18} /> : <Link size={18} />}
      </ToolbarButton>
      {linkInput}

      <ToolbarDivider />

      <ToolbarButton
        title={t(locale, 'formatPainter')}
        active={painterActive}
        onClick={togglePainter}
      >
        <Brush size={18} />
      </ToolbarButton>

      <ToolbarButton title={t(locale, 'clearFormat')} onClick={clearFormatting}>
        <Eraser size={18} />
      </ToolbarButton>
    </div>,
    anchorElem,
  );
}
