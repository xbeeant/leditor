import { $createCodeNode } from '@lexical/code-core';
import {
  $createListItemNode,
  $createListNode,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_TAB_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { INSERT_CODE_DRAWING_COMMAND } from './CodeDrawingPlugin';
import { useLocale } from '../LocaleContext';
import { INSERT_MERMAID_COMMAND } from './MermaidPlugin';
import { SLASH_ITEMS, type SlashAction, SlashMenu } from '../ui/SlashMenu';
import { $createTable, insertBlockAfter } from '../commands';
import { t } from '../i18n';

const MAX_QUERY_LENGTH = 30;

interface SlashCommandPluginProps {
  onOpenEquation: (inline: boolean) => void;
  onOpenImage: () => void;
  onOpenFileUpload: () => void;
}

export function SlashCommandPlugin({
  onOpenEquation,
  onOpenImage,
  onOpenFileUpload,
}: SlashCommandPluginProps) {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const isEditable = editor.isEditable();
  const callbacksRef = useRef({
    onOpenEquation,
    onOpenImage,
    onOpenFileUpload,
  });
  callbacksRef.current = { onOpenEquation, onOpenImage, onOpenFileUpload };

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const handleTextChange = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        closeMenu();
        return;
      }

      const anchor = selection.anchor;
      if (anchor.type !== 'text') {
        closeMenu();
        return;
      }

      const node = anchor.getNode();
      if (!$isTextNode(node)) {
        closeMenu();
        return;
      }

      const text = node.getTextContent();
      const offset = anchor.offset;
      const before = text.slice(0, offset);

      // 匹配以 "/" 开头的查询（位于段落起始或空格后）
      const slashMatch = before.match(/(?:^|\s)\/([^/]*)$/);

      if (slashMatch) {
        const queryText = slashMatch[1];
        if (queryText.length > MAX_QUERY_LENGTH) {
          closeMenu();
          return;
        }
        // 计算光标位置
        const editorElement = editor.getRootElement();
        if (editorElement) {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.rangeCount > 0) {
            const range = domSelection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setPosition({
              top: rect.bottom + 4,
              left: Math.max(8, rect.left),
            });
          } else {
            const elRect = editorElement.getBoundingClientRect();
            setPosition({ top: elRect.top + 60, left: elRect.left + 80 });
          }
        }
        setQuery(queryText);
        setActiveIndex(0);
        if (!menuOpen) setMenuOpen(true);
      } else {
        closeMenu();
      }
    });
  }, [editor, menuOpen, closeMenu]);

  useEffect(() => {
    if (!isEditable) return;
    return editor.registerUpdateListener(handleTextChange);
  }, [editor, handleTextChange, isEditable]);

  const filteredItems = SLASH_ITEMS.filter((item) =>
    item.keyword.some((kw) => kw.toLowerCase().includes(query.toLowerCase())),
  );

  // 过滤结果数量变化时，确保 activeIndex 始终落在有效范围内，
  // 避免因旧的索引越界导致 ArrowUp/ArrowDown 循环时跳到错误条目。
  useEffect(() => {
    if (filteredItems.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((i) => Math.min(i, filteredItems.length - 1));
  }, [filteredItems.length]);

  // 移除开头的 slash + 查询文本，让光标回到原文位置
  const removeSlashText = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchor = selection.anchor;
      const node = anchor.getNode();
      if (!$isTextNode(node)) return;
      const text = node.getTextContent();
      const offset = anchor.offset;
      const before = text.slice(0, offset);
      const slashMatch = before.match(/(?:^|\s)\/([^/]*)$/) as RegExpMatchArray;
      if (!slashMatch) return;
      const slashStart = slashMatch.index! + slashMatch[0].indexOf('/');
      const slashEnd = offset;
      node.spliceText(slashStart, slashEnd - slashStart, '', false);
      // 选区回到 slash 起始
      const newSel = $getSelection();
      if ($isRangeSelection(newSel)) {
        newSel.anchor.set(node.getKey(), slashStart, 'text');
        newSel.focus.set(node.getKey(), slashStart, 'text');
      }
    });
  }, [editor]);

  const executeAction = useCallback(
    (action: SlashAction) => {
      const {
        onOpenEquation: oe,
        onOpenImage: oi,
        onOpenFileUpload: ofu,
      } = callbacksRef.current;
      removeSlashText();

      switch (action) {
        case 'paragraph':
          insertBlockAfter(editor, () => $createParagraphNode());
          break;
        case 'h1':
        case 'h2':
        case 'h3':
          insertBlockAfter(editor, () => $createHeadingNode(action));
          break;
        case 'quote':
          insertBlockAfter(editor, () => $createQuoteNode());
          break;
        case 'code':
          insertBlockAfter(editor, () => $createCodeNode());
          break;
        case 'bullet':
        case 'number':
        case 'check':
          if (action === 'check') {
            editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
          } else {
            insertBlockAfter(editor, () => {
              const list = $createListNode(action);
              list.append($createListItemNode());
              return list;
            });
          }
          break;
        case 'table':
          insertBlockAfter(editor, () => $createTable(3, 3));
          break;
        case 'divider':
          insertBlockAfter(editor, () => $createHorizontalRuleNode());
          break;
        case 'image':
          oi();
          break;
        case 'equation':
          oe(false);
          break;
        case 'inlineEquation':
          oe(true);
          break;
        case 'mermaid':
          editor.dispatchCommand(
            INSERT_MERMAID_COMMAND,
            t(locale, 'mermaidSampleContent'),
          );
          break;
        case 'codeDrawing':
          editor.dispatchCommand(INSERT_CODE_DRAWING_COMMAND, undefined);
          break;
        case 'file':
          ofu();
          break;
        default:
          break;
      }
      closeMenu();
    },
    [editor, removeSlashText, closeMenu, locale],
  );

  const handleArrowDown = useCallback(() => {
    if (!menuOpen) return false;
    if (filteredItems.length === 0) return true;
    setActiveIndex((i) => (i + 1) % filteredItems.length);
    return true;
  }, [menuOpen, filteredItems.length]);

  const handleArrowUp = useCallback(() => {
    if (!menuOpen) return false;
    if (filteredItems.length === 0) return true;
    setActiveIndex(
      (i) => (i - 1 + filteredItems.length) % filteredItems.length,
    );
    return true;
  }, [menuOpen, filteredItems.length]);

  const handleEnter = useCallback(
    (event: KeyboardEvent | null) => {
      if (!menuOpen || filteredItems.length === 0) return false;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const idx =
        ((activeIndex % filteredItems.length) + filteredItems.length) %
        filteredItems.length;
      executeAction(filteredItems[idx].action);
      return true;
    },
    [menuOpen, filteredItems, activeIndex, executeAction],
  );

  const handleTab = useCallback(
    (event: KeyboardEvent | null) => {
      if (!menuOpen || filteredItems.length === 0) return false;
      event?.preventDefault?.();
      const idx =
        ((activeIndex % filteredItems.length) + filteredItems.length) %
        filteredItems.length;
      executeAction(filteredItems[idx].action);
      return true;
    },
    [menuOpen, filteredItems, activeIndex, executeAction],
  );

  useEffect(() => {
    if (!isEditable) return;
    const unregs = [
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, handleArrowDown, 2),
      editor.registerCommand(KEY_ARROW_UP_COMMAND, handleArrowUp, 2),
      editor.registerCommand(KEY_ENTER_COMMAND, handleEnter, 2),
      editor.registerCommand(KEY_TAB_COMMAND, handleTab, 2),
    ];
    return () => {
      for (const u of unregs) {
        u();
      }
    };
  }, [
    editor,
    isEditable,
    handleArrowDown,
    handleArrowUp,
    handleEnter,
    handleTab,
  ]);

  if (!menuOpen) return null;

  return createPortal(
    <SlashMenu
      query={query}
      top={position.top}
      left={position.left}
      activeIndex={activeIndex}
      onSelect={(action) => executeAction(action)}
    />,
    document.body,
  );
}
