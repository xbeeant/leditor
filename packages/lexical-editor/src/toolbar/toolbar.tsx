import { $createCodeNode, $isCodeNode } from '@lexical/code-core';
import {
  $createLinkNode,
  $isLinkNode,
  TOGGLE_LINK_COMMAND,
} from '@lexical/link';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
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
import { List, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TOGGLE_COMMENT_INPUT_COMMAND } from '../comment';
import { type Locale, t } from '../i18n';
import { $createRubyNode } from '../nodes';
import { $insertListStyle, type ExtendedListType } from '../nodes';
import { AlignGroup } from './align-group';
import { BlockGroup } from './block-group';
import { ClearFormatGroup } from './clear-format-group';
import { ColorGroup } from './color-group';
import { HEADING_FONT_SIZE_MAP, MIXED_FONT_SIZE } from './constants';
import { FindReplaceButton } from './find-replace-button';
import { FontGroup } from './font-group';
import { FormatPainter } from './format-painter';
import { HistoryGroup } from './history-group';
import { InsertMenu } from './insert-menu';
import { LinkGroup } from './link-group';
import { RubyGroup } from './ruby-group';
import { TableGroup } from './table-group';
import { TextFormatGroup } from './text-format-group';
import { ToolbarDivider } from './toolbar-divider';
import type {
  AlignType,
  BlockType,
  BulletStyleType,
  TextFormat,
} from './types';

/** 随编辑器选区变化而同步的快照状态 */
interface ToolbarSnapshot {
  blockType: BlockType;
  codeLanguage: string;
  fontFamily: string;
  fontSize: string;
  fontColor: string;
  bgColor: string;
  activeAlign: AlignType;
  isRTL: boolean;
  inTable: boolean;
  linkActive: boolean;
  formats: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    subscript: boolean;
    superscript: boolean;
    code: boolean;
  };
}

const INITIAL_SNAPSHOT: ToolbarSnapshot = {
  blockType: 'paragraph',
  codeLanguage: 'javascript',
  fontFamily: '',
  fontSize: '',
  fontColor: '#000000',
  bgColor: 'transparent',
  activeAlign: 'left',
  isRTL: false,
  inTable: false,
  linkActive: false,
  formats: {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false,
    code: false,
  },
};

/** 浅比较两份快照是否等价，用于在选区未变化时跳过不必要的重绘 */
function isSameSnapshot(a: ToolbarSnapshot, b: ToolbarSnapshot): boolean {
  return (
    a.blockType === b.blockType &&
    a.codeLanguage === b.codeLanguage &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontColor === b.fontColor &&
    a.bgColor === b.bgColor &&
    a.activeAlign === b.activeAlign &&
    a.isRTL === b.isRTL &&
    a.inTable === b.inTable &&
    a.linkActive === b.linkActive &&
    a.formats.bold === b.formats.bold &&
    a.formats.italic === b.formats.italic &&
    a.formats.underline === b.formats.underline &&
    a.formats.strikethrough === b.formats.strikethrough &&
    a.formats.subscript === b.formats.subscript &&
    a.formats.superscript === b.formats.superscript &&
    a.formats.code === b.formats.code
  );
}

export function Toolbar({
  toc,
  onTogglePin,
  pinned,
  showComments,
  onToggleComments,
  onToggleFindReplace,
  locale,
}: {
  toc?: boolean;
  onTogglePin?: () => void;
  pinned?: boolean;
  showComments?: boolean;
  onToggleComments?: () => void;
  onToggleFindReplace?: () => void;
  locale: Locale;
  readOnly: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  // 撤销/重做能力由独立命令驱动，与选区快照分开维护
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // 其余选区相关的状态合并为单个快照，一次更新只触发一次 setState
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot>(INITIAL_SNAPSHOT);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      const inTable = $isTableSelection(selection);

      // 选区无效时保留其余快照字段不变，仅同步表格状态
      setSnapshot((prev) => {
        if (prev.inTable === inTable) return prev;
        return { ...prev, inTable };
      });
      return;
    }
    const anchorNode = selection.anchor.getNode();
    const inTable = $findCellNode(anchorNode) !== null;

    const formats = {
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      subscript: selection.hasFormat('subscript'),
      superscript: selection.hasFormat('superscript'),
      code: selection.hasFormat('code'),
    };
    const linkActive =
      $isLinkNode(anchorNode) ||
      anchorNode.getParents().some((n) => $isLinkNode(n));

    const topLevel =
      anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();
    const element = topLevel as ElementNode;

    let blockType: BlockType;
    let codeLanguage = 'javascript';
    if ($isListNode(element)) {
      const listType = element.getListType();
      blockType =
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
              : 'number';
    } else if ($isHeadingNode(element)) {
      blockType = element.getTag() as BlockType;
    } else if ($isQuoteNode(element)) {
      blockType = 'quote';
    } else if ($isCodeNode(element)) {
      blockType = 'code';
      codeLanguage =
        (
          element as unknown as { getLanguage?: () => string }
        ).getLanguage?.() ?? 'javascript';
    } else {
      blockType = 'paragraph';
    }

    // 字体 / 颜色 / 背景色：从选中文本读取（参考 ca/lexical/packages/lib）
    const fontFamily = $getSelectionStyleValueForProperty(
      selection,
      'font-family',
      'Arial',
    );
    const fontColor = $getSelectionStyleValueForProperty(
      selection,
      'color',
      '#000000',
    );
    const bgColor = $getSelectionStyleValueForProperty(
      selection,
      'background-color',
      'transparent',
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
    const fontSize = isFontSizeMixed
      ? MIXED_FONT_SIZE
      : (commonFontSize ?? blockDefaultFontSize);
    const formatType = element.getFormatType?.() ?? '';
    const activeAlign = (formatType || 'left') as AlignType;
    const isRTL = element.getDirection?.() === 'rtl';

    const next: ToolbarSnapshot = {
      blockType,
      codeLanguage,
      fontFamily,
      fontSize,
      fontColor,
      bgColor,
      activeAlign,
      isRTL,
      inTable,
      linkActive,
      formats,
    };

    // 仅当选区相关状态发生变化时才触发重绘，避免每次输入都整条重渲染
    setSnapshot((prev) => (isSameSnapshot(prev, next) ? prev : next));
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

  const applyBlockType = useCallback(
    (value: BlockType) => {
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
    },
    [editor],
  );

  // 无序列表标记样式切换
  const applyBulletStyle = useCallback(
    (style: BulletStyleType) => {
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
    },
    [editor],
  );

  const applyFontFamily = useCallback(
    (family: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { 'font-family': family || '' });
        }
      });
    },
    [editor],
  );

  const applyFontSize = useCallback(
    (size: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { 'font-size': size || '' });
        }
      });
    },
    [editor],
  );

  const applyColor = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { color });
        }
      });
      // 乐观更新：使按钮立即反馈，随后由编辑器更新监听兜底校准
      setSnapshot((prev) => ({ ...prev, fontColor: color }));
    },
    [editor],
  );

  const applyBgColor = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { 'background-color': color });
        }
      });
      setSnapshot((prev) => ({ ...prev, bgColor: color }));
    },
    [editor],
  );

  const applyAlign = useCallback(
    (align: AlignType) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align);
      setSnapshot((prev) => ({ ...prev, activeAlign: align }));
    },
    [editor],
  );

  const applyFormat = useCallback(
    (format: TextFormat) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor],
  );

  const toggleLink = useCallback(() => {
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
  }, [editor]);

  const commitLink = useCallback(() => {
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
  }, [editor, linkUrl]);

  const applyCodeLanguage = useCallback(
    (language: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const top = selection.anchor.getNode().getTopLevelElementOrThrow();
          if ($isCodeNode(top)) top.setLanguage(language);
        }
      });
      setSnapshot((prev) => ({ ...prev, codeLanguage: language }));
    },
    [editor],
  );

  const insertRuby = useCallback(
    (text: string, annotation: string) => {
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
    },
    [editor],
  );

  const toggleRTL = useCallback(() => {
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        const top = sel.anchor.getNode().getTopLevelElementOrThrow();
        top.setDirection(snapshot.isRTL ? 'ltr' : 'rtl');
      }
    });
  }, [editor, snapshot.isRTL]);

  const clearFormatting = useCallback(() => {
    editor.update(() => {
      const sel = $getSelection();
      if (!$isRangeSelection(sel)) return;

      // 1. 清除文本格式（粗体、斜体、下划线等）：直接清空文本节点的格式位。
      //    不能用 FORMAT_TEXT_COMMAND（它是“切换”语义）且嵌套在 update 内分发
      //    命令不可靠，改为对选区内的文本节点 setFormat(0) 精确清空。
      for (const node of sel.extract()) {
        if ($isTextNode(node)) {
          node.setFormat(0);
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
  }, [editor]);

  // 稳定化事件回调，配合 memo 化的子组件减少不必要的重渲染
  const handleUndo = useCallback(
    () => editor.dispatchCommand(UNDO_COMMAND, undefined),
    [editor],
  );
  const handleRedo = useCallback(
    () => editor.dispatchCommand(REDO_COMMAND, undefined),
    [editor],
  );
  const handleOutdent = useCallback(
    () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
    [editor],
  );
  const handleIndent = useCallback(
    () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
    [editor],
  );
  const handleLinkClose = useCallback(() => setLinkEditorOpen(false), []);

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-10 flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-gray-200 bg-linear-to-b from-white to-gray-50/70 px-2 py-1.5 shadow-sm backdrop-blur *:shrink-0 scrollbar-none"
    >
      <HistoryGroup
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <ToolbarDivider />

      <FormatPainter />
      <ClearFormatGroup onClear={clearFormatting} />

      <ToolbarDivider />

      <InsertMenu />

      <ToolbarDivider />

      <BlockGroup
        blockType={snapshot.blockType}
        onBlockTypeChange={applyBlockType}
        codeLanguage={snapshot.codeLanguage}
        onCodeLanguageChange={applyCodeLanguage}
        onBulletStyleChange={applyBulletStyle}
      />

      <ToolbarDivider />

      <FontGroup
        fontFamily={snapshot.fontFamily}
        onFontFamilyChange={applyFontFamily}
        fontSize={snapshot.fontSize}
        onFontSizeChange={applyFontSize}
      />

      <ToolbarDivider />

      <TextFormatGroup formats={snapshot.formats} onFormat={applyFormat} />

      <ToolbarDivider />

      <ColorGroup
        fontColor={snapshot.fontColor}
        bgColor={snapshot.bgColor}
        onFontColorChange={applyColor}
        onBgColorChange={applyBgColor}
      />

      <LinkGroup
        active={snapshot.linkActive}
        open={linkEditorOpen}
        url={linkUrl}
        onToggle={toggleLink}
        onUrlChange={setLinkUrl}
        onCommit={commitLink}
        onClose={handleLinkClose}
      />

      <RubyGroup onInsert={insertRuby} />

      <ToolbarDivider />

      <AlignGroup
        activeAlign={snapshot.activeAlign}
        isRTL={snapshot.isRTL}
        onAlign={applyAlign}
        onOutdent={handleOutdent}
        onIndent={handleIndent}
        onToggleRTL={toggleRTL}
      />

      <ToolbarDivider />

      <FindReplaceButton onToggle={() => onToggleFindReplace?.()} />

      {snapshot.inTable && (
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
          <MessageSquarePlus size={18} />
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
          title={
            showComments
              ? t(locale, 'hideCommentsPanel')
              : t(locale, 'showCommentsPanel')
          }
        >
          <MessageSquare size={18} />
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
            title={pinned ? t(locale, 'unpinToc') : t(locale, 'pinToc')}
          >
            <List size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
