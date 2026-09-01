import { $createCodeNode, $isCodeNode } from '@lexical/code-core';
import { $isListNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type ElementFormatType,
  type ElementNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { Paintbrush } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import {
  $insertListStyle,
  type ExtendedListType,
} from '../nodes/ListStyleNode';
import { ToolbarButton } from './ToolbarButton';
import type { BlockType } from './types';

/** 一次格式刷需要复制的完整格式：字符格式 + 内联样式 + 块级格式 */
interface CapturedFormat {
  // 字符级
  format: number;
  style: string;
  // 块级
  blockType: BlockType;
  align: ElementFormatType;
  direction: 'ltr' | 'rtl' | null;
}

/** 块级列表类型（复用 $insertListStyle 处理） */
const LIST_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  'bullet',
  'number',
  'check',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
]);

/**
 * 从选区锚点解析其所在顶层元素的块级格式。
 * 逻辑与 Toolbar.updateToolbar 的块类型判定保持一致。
 */
function $resolveBlockInfo(anchorNode: LexicalNode): {
  blockType: BlockType;
  align: ElementFormatType;
  direction: 'ltr' | 'rtl' | null;
} {
  const topLevel =
    anchorNode.getKey() === 'root'
      ? anchorNode
      : anchorNode.getTopLevelElementOrThrow();
  const element = topLevel as ElementNode;

  let blockType: BlockType = 'paragraph';
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
  }

  return {
    blockType,
    align: element.getFormatType?.() ?? 'left',
    direction: element.getDirection?.() ?? null,
  };
}

/**
 * 格式刷：把源选区的字符格式（粗体/斜体等位掩码）、内联样式（字号/颜色/背景/字体）
 * 与块级格式（标题/对齐/方向/列表）一起复制，用户随后勾选目标文本即可一次性套用。
 *
 * 核心思路（参考 ca/lexical/packages/lib）：点击按钮时从编辑器当前选区读取格式快照，
 * 在编辑器根元素上挂一次性 mouseup 监听，用户完成勾选后用 extract() 精准取出文本节点
 * 套用格式，随后自动取消激活。
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

  /** 将完整格式（字符 + 块级）套用到目标选区 */
  const applyFormatToSelection = useCallback(
    (captured: CapturedFormat) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        // 1. 字符格式 + 内联样式：extract() 按选区边界切断 TextNode，
        //    保证只命中用户高亮区域。折叠选区无法应用字符格式，跳过。
        if (!selection.isCollapsed()) {
          for (const node of selection.extract()) {
            if ($isTextNode(node)) {
              node.setFormat(captured.format);
              node.setStyle(captured.style);
            }
          }
        }

        // 2. 块级格式：标题 / 引用 / 代码 / 列表 / 对齐 / 方向
        applyBlockFormat(selection, captured);
      });
    },
    [editor],
  );

  const activate = useCallback(() => {
    // 从编辑器当前状态读取源选区，解析字符格式、内联样式与块级格式
    const captured: CapturedFormat = {
      format: 0,
      style: '',
      blockType: 'paragraph',
      align: 'left',
      direction: null,
    };
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const anchorNode = selection.anchor.getNode();
      // 优先取锚点处的文本节点，确保拿到真实的字符格式与内联样式
      const textNode = $isTextNode(anchorNode)
        ? anchorNode
        : selection.getNodes().find($isTextNode);
      captured.format = textNode ? textNode.getFormat() : selection.format;
      captured.style = textNode ? textNode.getStyle() : '';
      const block = $resolveBlockInfo(anchorNode);
      captured.blockType = block.blockType;
      captured.align = block.align;
      captured.direction = block.direction;
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

/**
 * 就地应用块级格式：先按捕获的块类型切换标题/引用/代码/列表，再统一设置对齐与方向。
 * 仅作用于选区涉及的顶层元素。
 */
function applyBlockFormat(
  selection: RangeSelection,
  captured: CapturedFormat,
): void {
  const blockType = captured.blockType ?? 'paragraph';

  // 列表：复用扩展列表的插入/合并逻辑
  if (LIST_BLOCK_TYPES.has(blockType)) {
    $insertListStyle(blockType as ExtendedListType);
  } else {
    // 标题 / 引用 / 代码 / 段落
    const headingType = blockType as 'h1' | 'h2' | 'h3' | 'h4';
    $setBlocksType(selection, () => {
      if (blockType === 'quote') return $createQuoteNode();
      if (blockType === 'code') return $createCodeNode();
      if (blockType === 'paragraph') return $createParagraphNode();
      return $createHeadingNode(headingType);
    });
  }

  // 对齐 + 方向：应用到选区涉及的所有顶层元素
  for (const node of selection.getNodes()) {
    const top =
      node.getKey() === 'root' ? node : node.getTopLevelElementOrThrow();
    if ($isElementNode(top)) {
      // 默认左对齐不覆盖目标，避免刷子无意改变目标对齐
      if (captured.align !== 'left') top.setFormat(captured.align);
      if (captured.direction) top.setDirection(captured.direction);
    }
  }
}
