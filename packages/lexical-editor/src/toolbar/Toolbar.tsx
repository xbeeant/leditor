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
import {
  Eye,
  EyeOff,
  Globe,
  List,
  MessageSquare,
  MessageSquarePlus,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EquationModal } from '../EquationModal';
import { $createEquationNode } from '../EquationNode';
import { ImageModal } from '../ImageModal';
import { $createImageNode } from '../ImageNode';
import {
  $createListStyleNode,
  $insertListStyle,
  type ExtendedListType,
} from '../ListStyleNode';
import { $createRubyNode } from '../RubyNode';
import {
  $createTable,
  insertBlockAfter,
  insertBlockWithParagraphAfter,
  insertParagraphAfter,
} from '../commands';
import { INSERT_MERMAID_COMMAND } from '../MermaidPlugin';
import { INSERT_CALLOUT_COMMAND } from '../CalloutPlugin';
import { INSERT_CODE_DRAWING_COMMAND } from '../CodeDrawingPlugin';
import { TOGGLE_COMMENT_INPUT_COMMAND } from '../comment/commentCommands';
import { type Locale, localeNames, t } from '../i18n';
import { AlignGroup } from './AlignGroup';
import { BlockGroup } from './BlockGroup';
import { ClearFormatGroup } from './ClearFormatGroup';
import { ColorGroup } from './ColorGroup';
import { FindReplaceButton } from './FindReplaceButton';
import { FontGroup } from './FontGroup';
import { FormatPainter } from './FormatPainter';
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
  onLocaleChange,
  readOnly,
  onReadOnlyChange,
}: {
  toc?: boolean;
  onTogglePin?: () => void;
  pinned?: boolean;
  showComments?: boolean;
  onToggleComments?: () => void;
  onToggleFindReplace?: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  readOnly: boolean;
  onReadOnlyChange: (readOnly: boolean) => void;
}) {
  const [editor] = useLexicalComposerContext();
  // 撤销/重做能力由独立命令驱动，与选区快照分开维护
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // 其余选区相关的状态合并为单个快照，一次更新只触发一次 setState
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot>(INITIAL_SNAPSHOT);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [equationModalOpen, setEquationModalOpen] = useState(false);
  const [equationModalInline, setEquationModalInline] = useState(false);
  const [equationCursorPosition, setEquationCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageCursorPosition, setImageCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
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

  const insertTable = useCallback(
    (rows: number, cols: number) => {
      insertBlockAfter(editor, () => $createTable(cols, rows));
    },
    [editor],
  );

  /**
   * 获取编辑器内光标位置，用于定位公式 / 图片模态框。
   *
   * 不能直接依赖 window.getSelection()：点击 toolbar 按钮后编辑器失焦，
   * 浏览器选区会落在按钮上（toolbar 区域），导致模态框定位错误。
   * 因此优先从 Lexical 维护的选区锚点节点拿到 DOM 元素来定位。
   */
  const getCursorPosition = useCallback((): { x: number; y: number } | null => {
    const editorRoot = editor.getRootElement();

    // 1. 浏览器实时选区（配合 toolbar 按钮 onMouseDown preventDefault，
    //    光标仍停留在编辑器内；此处再校验选区确在编辑器 DOM 内兜底）
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0 && editorRoot) {
      const range = domSelection.getRangeAt(0);
      // 选区容器必须位于编辑器 DOM 树内，避免取到按钮等外部位置
      if (editorRoot.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.bottom };
      }
    }

    // 2. 从 Lexical 选区锚点节点定位（编辑器失焦后仍可靠）
    let pos: { x: number; y: number } | null = null;
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const element = editor.getElementByKey(
        selection.anchor.getNode().getKey(),
      );
      if (element) {
        const rect = element.getBoundingClientRect();
        pos = { x: rect.left + rect.width / 2, y: rect.bottom };
      }
    });
    if (pos) return pos;

    // 3. 兜底：编辑器中心偏上
    if (editorRoot) {
      const editorRect = editorRoot.getBoundingClientRect();
      return {
        x: editorRect.left + editorRect.width / 2,
        y: editorRect.top + Math.min(120, editorRect.height / 3),
      };
    }
    return null;
  }, [editor]);

  const insertImage = useCallback(() => {
    setImageCursorPosition(getCursorPosition());
    setImageModalOpen(true);
  }, [getCursorPosition]);

  const handleImageConfirm = useCallback(
    (src: string, altText: string) => {
      insertBlockAfter(editor, () => $createImageNode({ src, altText }));
    },
    [editor],
  );

  const insertEquation = useCallback(
    (inline: boolean) => {
      setEquationCursorPosition(getCursorPosition());
      setEquationModalInline(inline);
      setEquationModalOpen(true);
    },
    [getCursorPosition],
  );

  const handleEquationConfirm = useCallback(
    (equation: string) => {
      if (equationModalInline) {
        // 行内公式：插入到当前光标位置，与周围文本同行
        const hasRange = editor.getEditorState().read(() => {
          const selection = $getSelection();
          return $isRangeSelection(selection);
        });
        if (hasRange) {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            selection.insertNodes([$createEquationNode(equation, true)]);
          });
          editor.focus();
          return;
        }
      }
      // 块级公式（或无有效选区时退化为块级插入），其后追加正文段落以便继续输入
      insertBlockWithParagraphAfter(editor, () =>
        $createEquationNode(equation, equationModalInline),
      );
    },
    [editor, equationModalInline],
  );

  const insertBlockOfType = useCallback(
    (type: InsertBlockType) => {
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
        case 'equation':
          insertEquation(false);
          break;
        case 'inlineEquation':
          insertEquation(true);
          break;
        case 'mermaid':
          editor.dispatchCommand(
            INSERT_MERMAID_COMMAND,
            'flowchart TD\n  A[开始] --> B[结束]',
          );
          break;
        case 'callout':
          editor.dispatchCommand(INSERT_CALLOUT_COMMAND, { icon: 'note' });
          break;
        case 'codeDrawing':
          editor.dispatchCommand(INSERT_CODE_DRAWING_COMMAND, undefined);
          break;
        default:
          break;
      }
    },
    [editor, insertTable, insertImage, insertEquation],
  );

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

      <InsertGroup onInsert={insertBlockOfType} onInsertTable={insertTable} />

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

      <FormatPainter />

      <ToolbarDivider />

      <ClearFormatGroup onClear={clearFormatting} />

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
          onClick={() => onLocaleChange(locale === 'zh-CN' ? 'en' : 'zh-CN')}
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
      <EquationModal
        open={equationModalOpen}
        onClose={() => setEquationModalOpen(false)}
        onConfirm={handleEquationConfirm}
        title={equationModalInline ? '插入行内公式' : '插入公式'}
        cursorPosition={equationCursorPosition}
      />
      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onConfirm={handleImageConfirm}
        cursorPosition={imageCursorPosition}
      />
    </div>
  );
}
