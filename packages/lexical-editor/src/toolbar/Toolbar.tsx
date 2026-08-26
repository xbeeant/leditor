import { $createCodeNode, $isCodeNode } from '@lexical/code-core';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import { List, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TOGGLE_COMMENT_INPUT_COMMAND } from '../comment/commentCommands';
import { $createImageNode } from '../ImageNode';
import {
  $createTable,
  insertBlockAfter,
  insertParagraphAfter,
} from '../commands';
import { AlignGroup } from './AlignGroup';
import { BlockGroup } from './BlockGroup';
import { ClearFormatGroup } from './ClearFormatGroup';
import { ColorGroup } from './ColorGroup';
import { FontGroup } from './FontGroup';
import { HistoryGroup } from './HistoryGroup';
import { InsertGroup } from './InsertGroup';
import { LinkGroup } from './LinkGroup';
import { TextFormatGroup } from './TextFormatGroup';
import { ToolbarDivider } from './ToolbarDivider';
import type {
  AlignType,
  BlockType,
  InsertBlockType,
  TextFormat,
} from './types';

export function Toolbar({toc, onTogglePin, pinned, showComments, onToggleComments}: {toc?: boolean, onTogglePin?: () => void, pinned?: boolean, showComments?: boolean, onToggleComments?: () => void}) {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('');
  const [fontColor, setFontColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('transparent');
  const [activeAlign, setActiveAlign] = useState<AlignType>('left');
  const [isRTL, setIsRTL] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false,
    code: false,
  });
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkActive, setLinkActive] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    const anchorNode = selection.anchor.getNode();

    setFormats({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      subscript: selection.hasFormat('subscript'),
      superscript: selection.hasFormat('superscript'),
      code: selection.hasFormat('code'),
    });
    setLinkActive(
      $isLinkNode(anchorNode) ||
        anchorNode.getParents().some((n) => $isLinkNode(n)),
    );

    const topLevel =
      anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();
    const element = topLevel as ElementNode;

    if ($isListNode(element)) {
      const listType = element.getListType();
      setBlockType(
        listType === 'bullet'
          ? 'bullet'
          : listType === 'number'
            ? 'number'
            : 'check',
      );
    } else if ($isHeadingNode(element)) {
      setBlockType(element.getTag() as BlockType);
    } else if ($isQuoteNode(element)) {
      setBlockType('quote');
    } else if ($isCodeNode(element)) {
      setBlockType('code');
      setCodeLanguage(
        (
          element as unknown as { getLanguage?: () => string }
        ).getLanguage?.() ?? 'javascript',
      );
    } else {
      setBlockType('paragraph');
    }

    const style = element.getStyle?.() ?? '';
    setFontFamily(style.match(/font-family:\s*([^;]+)/i)?.[1]?.trim() ?? '');
    setFontSize(style.match(/font-size:\s*([^;]+)/i)?.[1]?.trim() ?? '');
    setFontColor(style.match(/color:\s*([^;]+)/i)?.[1]?.trim() ?? '#000000');
    setBgColor(
      style.match(/background-color:\s*([^;]+)/i)?.[1]?.trim() ?? 'transparent',
    );
    const formatType = element.getFormatType?.() ?? '';
    setActiveAlign((formatType || 'left') as AlignType);
    setIsRTL(element.getDirection?.() === 'rtl');
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateToolbar);
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  const applyBlockType = (value: BlockType) => {
    if (value === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (value === 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (value === 'check') {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      return;
    }
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (value === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (value === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (value === 'code') {
        $setBlocksType(selection, () => $createCodeNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(value));
      }
    });
  };

  const applyFontFamily = (family: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-family': family || '' });
      }
    });
  };

  const applyFontSize = (size: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': size ? `${size}px` : '' });
      }
    });
  };

  const applyColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
    setFontColor(color);
  };

  const applyBgColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': color });
      }
    });
    setBgColor(color);
  };

  const applyAlign = (align: AlignType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align);
    setActiveAlign(align);
  };

  const applyFormat = (format: TextFormat) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const toggleLink = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = selection.anchor.getNode();
      const linkParent = node.getParents().find((n) => $isLinkNode(n));
      if (linkParent) {
        setLinkUrl(linkParent.getURL());
      } else {
        setLinkUrl('');
      }
      setLinkEditorOpen((v) => !v);
    });
  };

  const commitLink = () => {
    const url = linkUrl.trim();
    if (url === '') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
    setLinkEditorOpen(false);
    editor.focus();
  };

  const insertTable = () => {
    insertBlockAfter(editor, () => $createTable(3, 3));
  };

  const insertImage = () => {
    const src = window.prompt('Image URL');
    if (!src) return;
    const altText = window.prompt('Alt text', '') ?? '';
    insertBlockAfter(editor, () => $createImageNode({ src, altText }));
  };

  const insertBlockOfType = (type: InsertBlockType) => {
    switch (type) {
      case 'paragraph':
        insertParagraphAfter(editor);
        break;
      case 'h1':
        insertBlockAfter(editor, () => $createHeadingNode('h1'));
        break;
      case 'h2':
        insertBlockAfter(editor, () => $createHeadingNode('h2'));
        break;
      case 'h3':
        insertBlockAfter(editor, () => $createHeadingNode('h3'));
        break;
      case 'h4':
        insertBlockAfter(editor, () => $createHeadingNode('h4'));
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
        insertBlockAfter(editor, () => {
          const list = $createListNode(type);
          list.append($createListItemNode());
          return list;
        });
        break;
      case 'table':
        insertTable();
        break;
      case 'divider':
        insertBlockAfter(editor, () => $createHorizontalRuleNode());
        break;
      case 'image':
        insertImage();
        break;
      default:
        break;
    }
  };

  const applyCodeLanguage = (language: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const top = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isCodeNode(top)) top.setLanguage(language);
      }
    });
    setCodeLanguage(language);
  };

  const toggleRTL = () => {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const top = sel.anchor.getNode().getTopLevelElementOrThrow();
        top.setDirection(isRTL ? 'ltr' : 'rtl');
      }
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        $patchStyleText(sel, {
          color: '',
          'background-color': '',
          'font-size': '',
          'font-family': '',
        });
      }
    });
  };

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50/70 px-2 py-1.5 shadow-sm backdrop-blur"
    >
      <HistoryGroup
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        onRedo={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      />

      <ToolbarDivider />

      <InsertGroup onInsert={insertBlockOfType} />

      <ToolbarDivider />

      <BlockGroup
        blockType={blockType}
        onBlockTypeChange={applyBlockType}
        codeLanguage={codeLanguage}
        onCodeLanguageChange={applyCodeLanguage}
      />

      <ToolbarDivider />

      <FontGroup
        fontFamily={fontFamily}
        onFontFamilyChange={applyFontFamily}
        fontSize={fontSize}
        onFontSizeChange={applyFontSize}
      />

      <ToolbarDivider />

      <TextFormatGroup formats={formats} onFormat={applyFormat} />

      <ToolbarDivider />

      <ColorGroup
        fontColor={fontColor}
        bgColor={bgColor}
        onFontColorChange={applyColor}
        onBgColorChange={applyBgColor}
      />

      <LinkGroup
        active={linkActive}
        open={linkEditorOpen}
        url={linkUrl}
        onToggle={toggleLink}
        onUrlChange={setLinkUrl}
        onCommit={commitLink}
        onClose={() => setLinkEditorOpen(false)}
      />

      <ToolbarDivider />

      <AlignGroup
        activeAlign={activeAlign}
        isRTL={isRTL}
        onAlign={applyAlign}
        onOutdent={() =>
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)
        }
        onIndent={() =>
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)
        }
        onToggleRTL={toggleRTL}
      />

      <ToolbarDivider />

      <ClearFormatGroup onClear={clearFormatting} />

      <ToolbarDivider />

      <button
        type="button"
        onClick={() => editor.dispatchCommand(TOGGLE_COMMENT_INPUT_COMMAND, true)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
        title="Add comment"
      >
        <MessageSquarePlus size={14} />
      </button>

      <ToolbarDivider />

      <button
        type="button"
        onClick={onToggleComments}
        aria-pressed={showComments}
        className={
          showComments
            ? 'inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-200 text-gray-800 hover:bg-gray-100'
            : 'inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100'
        }
        title={showComments ? 'Hide comments panel' : 'Show comments panel'}
      >
        <MessageSquare size={14} />
      </button>

      {toc && (
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          className={
            pinned
              ? 'inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-200 text-gray-800 hover:bg-gray-100'
              : 'inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100'
          }
          title={pinned ? 'Unpin table of contents' : 'Pin table of contents'}
        >
          <List size={14} />
        </button>
      )}
    </div>
  );
}
