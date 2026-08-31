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
import { t } from './i18n';
import { useLocale } from './LocaleContext';
import { TextFormatGroup } from './toolbar/TextFormatGroup';
import { ToolbarButton } from './toolbar/ToolbarButton';
import { ToolbarDivider } from './toolbar/ToolbarDivider';
import type { TextFormat } from './toolbar/types';
import { getDOMRangeRect } from './utils/get-dom-range-rect';
import { setFloatingElementPosition } from './utils/set-floating-element-position';

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
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const $updateToolbar = () => {
    const toolbarElem = toolbarRef.current;
    if (toolbarElem === null || !anchorElem) return;

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setVisible(false);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const linkParent = anchorNode
        .getParents()
        .find((n) => $isLinkNode(n));
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
      const root = editor.getRootElement();
      if (nativeSelection && nativeSelection.rangeCount > 0 && root) {
        const rangeRect = getDOMRangeRect(nativeSelection, root);
        setFloatingElementPosition(rangeRect, toolbarElem, anchorElem);
      }
    });
  };

  useEffect(() => {
    // anchorElem 本身即为可滚动的编辑区容器
    const scrollerElem = anchorElem;

    const handleResize = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
        const nativeSelection = window.getSelection();
        const root = editor.getRootElement();
        if (nativeSelection && root && toolbarRef.current) {
          const rangeRect = getDOMRangeRect(nativeSelection, root);
          setFloatingElementPosition(
            rangeRect,
            toolbarRef.current,
            anchorElem,
          );
        }
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
          if (visible) setVisible(false);
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
      className="pointer-events-auto absolute z-50 flex flex-nowrap items-center gap-0.5 rounded-md border border-gray-200 bg-white p-1 shadow-md"
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

      <ToolbarButton
        title={t(locale, 'clearFormat')}
        onClick={clearFormatting}
      >
        <Eraser size={18} />
      </ToolbarButton>
    </div>,
    anchorElem,
  );
}
