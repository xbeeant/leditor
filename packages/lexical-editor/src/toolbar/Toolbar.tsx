import { $createCodeNode, $isCodeNode } from '@lexical/code-core';
import {
  $createLinkNode,
  $isLinkNode,
  TOGGLE_LINK_COMMAND,
} from '@lexical/link';
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from '@lexical/selection';
import { $findCellNode, $isTableSelection } from '@lexical/table';
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
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
import { List, Globe, Eye, EyeOff, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { $createImageNode } from '../ImageNode';
import { type Locale, t, localeNames } from '../i18n';
import {
  $createListStyleNode,
  $insertListStyle,
  type ExtendedListType,
} from '../ListStyleNode';
import { $createRubyNode } from '../RubyNode';
import {
  $createTable,
  insertBlockAfter,
  insertParagraphAfter,
} from '../commands';
import { TOGGLE_COMMENT_INPUT_COMMAND } from '../comment/commentCommands';
import { AlignGroup } from './AlignGroup';
import { BlockGroup } from './BlockGroup';
import { ClearFormatGroup } from './ClearFormatGroup';
import { ColorGroup } from './ColorGroup';
import { FontGroup } from './FontGroup';
import { HistoryGroup } from './HistoryGroup';
import { InsertGroup } from './InsertGroup';
import { LinkGroup } from './LinkGroup';
import { RubyGroup } from './RubyGroup';
import { TableGroup } from './TableGroup';
import { TextFormatGroup } from './TextFormatGroup';
import { ToolbarDivider } from './ToolbarDivider';
import { HEADING_FONT_SIZE_MAP, MIXED_FONT_SIZE } from './constants';
import type {
  AlignType,
  BlockType,
  BulletStyleType,
  InsertBlockType,
  TextFormat,
} from './types';

export function Toolbar({
  toc,
  onTogglePin,
  pinned,
  showComments,
  onToggleComments,
  locale,
  onLocaleChange,
  readOnly,
  onReadOnlyChange,
}: {
  toc?: boolean;
  onTogglePin?: () => void;
  pinned?: boolean;
  showComments?: boolean;
  onToggleComments?: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
}) {
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
  const [inTable, setInTable] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      setInTable($isTableSelection(selection));
      return;
    }
    const anchorNode = selection.anchor.getNode();
    setInTable($findCellNode(anchorNode) !== null);

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
          : listType === 'check'
            ? 'check'
            : listType === 'number' ||
                listType === 'lower-alpha' ||
                listType === 'upper-alpha' ||
                listType === 'lower-roman' ||
                listType === 'upper-roman'
              ? (listType as BlockType)
              : 'number',
      );
      // 读取无序列表的标记样式
      if (listType === 'bullet') {
        // bullet list style is tracked internally, no state needed
      }
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

    // 字体 / 颜色 / 背景色：从选中文本读取（参考 ca/lexical/packages/lib）
    setFontFamily(
      $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial'),
    );
    setFontColor(
      $getSelectionStyleValueForProperty(selection, 'color', '#000000'),
    );
    setBgColor(
      $getSelectionStyleValueForProperty(
        selection,
        'background-color',
        'transparent',
      ),
    );

    // 字号：处理 mixed 与标题默认字号（参考 ca/lexical/packages/lib）
    const nodes = selection.getNodes();
    let commonFontSize: string | null = null;
    let isFontSizeMixed = false;
    let parentElement = anchorNode.getParent();
    while (parentElement?.isInline()) {
      parentElement = parentElement.getParent();
    }
    let blockDefaultFontSize = '16px';
    if (parentElement && $isHeadingNode(parentElement)) {
      blockDefaultFontSize =
        HEADING_FONT_SIZE_MAP[parentElement.getTag()] ?? '16px';
    }
    for (const node of nodes) {
      if (!$isTextNode(node)) continue;
      const style = node.getStyle();
      const match = style.match(/font-size:\s*([^;]+)/);
      const nodeFontSize = match?.[1]?.trim() ?? blockDefaultFontSize;
      if (commonFontSize === null) {
        commonFontSize = nodeFontSize;
      } else if (commonFontSize !== nodeFontSize) {
        isFontSizeMixed = true;
        break;
      }
    }
    setFontSize(
      isFontSizeMixed
        ? MIXED_FONT_SIZE
        : (commonFontSize ?? blockDefaultFontSize),
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
      editor.update(() => {
        $insertListStyle('bullet');
      });
      return;
    }
    if (value === 'number') {
      editor.update(() => {
        $insertListStyle('number');
      });
      return;
    }
    if (value === 'check') {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      return;
    }
    if (
      value === 'lower-alpha' ||
      value === 'upper-alpha' ||
      value === 'lower-roman' ||
      value === 'upper-roman'
    ) {
      editor.update(() => {
        $insertListStyle(value as ExtendedListType);
      });
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

  // 无序列表标记样式切换
  const applyBulletStyle = (style: BulletStyleType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      const topLevel =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      if ($isListNode(topLevel) && topLevel.getListType() === 'bullet') {
        // 已经是 bullet list，直接切换样式
        topLevel.setStyle(`list-style-type:${style}`);
      } else {
        // 不是 bullet list，先切换为 bullet list，再设置样式
        $insertListStyle('bullet');
        const newSelection = $getSelection();
        if (!$isRangeSelection(newSelection)) return;
        const newNode = newSelection.anchor.getNode();
        const newTop =
          newNode.getKey() === 'root'
            ? newNode
            : newNode.getTopLevelElementOrThrow();
        if ($isListNode(newTop) && newTop.getListType() === 'bullet') {
          newTop.setStyle(`list-style-type:${style}`);
        }
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
        $patchStyleText(selection, { 'font-size': size || '' });
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
    editor.getEditorState().read(
      () => {
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
      },
      { editor },
    );
  };

  const commitLink = () => {
    const url = linkUrl.trim();
    if (url === '') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      setLinkEditorOpen(false);
      editor.focus();
      return;
    }

    // 校验 URL 格式
    let finalUrl = url;
    try {
      new URL(url);
    } catch {
      try {
        new URL(`https://${url}`);
        finalUrl = `https://${url}`;
      } catch {
        return;
      }
    }

    // 检查选区是否有内容
    const hasSelection = editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;
      return !selection.isCollapsed();
    });

    if (hasSelection) {
      // 有选中文本，直接包裹为链接
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, finalUrl);
    } else {
      // 无选中文本，插入链接节点（显示 URL 文本）
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const linkNode = $createLinkNode(finalUrl);
        linkNode.append($createTextNode(finalUrl));
        selection.insertNodes([linkNode]);
      });
    }

    setLinkEditorOpen(false);
    editor.focus();
  };

  const insertTable = (rows: number, cols: number) => {
    insertBlockAfter(editor, () => $createTable(cols, rows));
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
          const list = $createListNode(
            type as Parameters<typeof $createListNode>[0],
          );
          list.append($createListItemNode());
          return list;
        });
        break;
      case 'lower-alpha':
      case 'upper-alpha':
      case 'lower-roman':
      case 'upper-roman':
        insertBlockAfter(editor, () => {
          const list = $createListStyleNode(type as ExtendedListType);
          list.append($createListItemNode());
          return list;
        });
        break;
      case 'table':
        insertTable(3, 3);
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

  const insertRuby = (text: string, annotation: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      // 获取选中的文本
      const selectedText = selection.getTextContent();
      const rubyText = text || selectedText || annotation;

      // 创建 ruby 节点
      const rubyNode = $createRubyNode({
        text: rubyText,
        annotation,
      });

      // 替换选区内容
      selection.insertNodes([rubyNode]);
    });
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
      if (!$isRangeSelection(sel)) return;

      // 1. 清除文本格式（粗体、斜体、下划线等）
      const textFormats: Array<TextFormat> = [
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'subscript',
        'superscript',
        'code',
      ];
      for (const format of textFormats) {
        if (sel.hasFormat(format)) {
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
        }
      }

      // 2. 清除内联样式
      $patchStyleText(sel, {
        color: '',
        'background-color': '',
        'font-size': '',
        'font-family': '',
        'font-weight': '',
        'font-style': '',
        'text-decoration': '',
        'line-height': '',
        'letter-spacing': '',
      });

      // 3. 块级元素转为段落
      const nodes = sel.getNodes();
      const changedBlocks = new Set<string>();
      for (const node of nodes) {
        let parent = node.getParent();
        // 向上找到顶层元素（root 的直接子节点）
        while (parent && parent.getParent()?.getKey() !== 'root') {
          parent = parent.getParent();
        }
        if (!parent || parent.getKey() === 'root') continue;
        const key = parent.getKey();
        if (changedBlocks.has(key)) continue;

        if ($isListNode(parent)) {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          changedBlocks.add(key);
        } else if (
          $isHeadingNode(parent) ||
          $isQuoteNode(parent) ||
          $isCodeNode(parent)
        ) {
          $setBlocksType(sel, () => $createParagraphNode());
          changedBlocks.add(key);
        }
      }
    });
  };

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-10 flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-gray-200 bg-linear-to-b from-white to-gray-50/70 px-2 py-1.5 shadow-sm backdrop-blur *:shrink-0 scrollbar-none"
    >
      <HistoryGroup
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        onRedo={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      />

      <ToolbarDivider />

      <InsertGroup onInsert={insertBlockOfType} onInsertTable={insertTable} />

      <ToolbarDivider />

      <BlockGroup
        blockType={blockType}
        onBlockTypeChange={applyBlockType}
        codeLanguage={codeLanguage}
        onCodeLanguageChange={applyCodeLanguage}
        onBulletStyleChange={applyBulletStyle}
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

      <RubyGroup onInsert={insertRuby} />

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

      {inTable && (
        <>
          <ToolbarDivider />
          <TableGroup />
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() =>
            editor.dispatchCommand(TOGGLE_COMMENT_INPUT_COMMAND, true)
          }
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          title={t(locale, 'addComment')}
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

        <ToolbarDivider />

        <button
          type="button"
          onClick={() =>
            onLocaleChange(locale === 'zh-CN' ? 'en' : 'zh-CN')
          }
          className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-gray-500 hover:bg-gray-100"
          title={t(locale, 'language')}
        >
          <Globe size={14} />
          <span>{localeNames[locale]}</span>
        </button>

        <ToolbarDivider />

        <button
          type="button"
          onClick={() => onReadOnlyChange(!readOnly)}
          className={
            readOnly
              ? 'inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200'
              : 'inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100'
          }
          title={readOnly ? t(locale, 'editable') : t(locale, 'readOnly')}
        >
          {readOnly ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}
