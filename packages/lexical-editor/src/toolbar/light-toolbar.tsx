import { $isCodeNode } from '@lexical/code-core';
import { $isLinkNode } from '@lexical/link';
import { $isListNode } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
} from '@lexical/selection';
import { $findCellNode, $isTableSelection } from '@lexical/table';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  type ElementNode,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ColorGroup } from './color-group';
import { HEADING_FONT_SIZE_MAP, MIXED_FONT_SIZE } from './constants';
import { LightInsertMenu } from './light-insert-menu';
import { TextFormatGroup } from './text-format-group';
import { ToolbarDivider } from './toolbar-divider';
import type { AlignType, BlockType, TextFormat } from './types';

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

export function LightToolbar() {
  const [editor] = useLexicalComposerContext();

  // 其余选区相关的状态合并为单个快照，一次更新只触发一次 setState
  const [snapshot, setSnapshot] = useState<ToolbarSnapshot>(INITIAL_SNAPSHOT);
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

  const applyFormat = useCallback(
    (format: TextFormat) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor],
  );

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-10 flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-gray-200 bg-linear-to-b from-white to-gray-50/70 px-2 py-1.5 shadow-sm backdrop-blur *:shrink-0 scrollbar-none"
    >
      <LightInsertMenu />

      <ToolbarDivider />

      <TextFormatGroup formats={snapshot.formats} onFormat={applyFormat} />

      <ToolbarDivider />

      <ColorGroup
        fontColor={snapshot.fontColor}
        bgColor={snapshot.bgColor}
        onFontColorChange={applyColor}
        onBgColorChange={applyBgColor}
      />
    </div>
  );
}
