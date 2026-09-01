import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  type ElementNode,
  KEY_DOWN_COMMAND,
  type LexicalNode,
  type PointType,
} from 'lexical';
import { useEffect } from 'react';

// 判断光标是否在指定 boundaryNode (边界节点) 的绝对末尾
function isAtAbsoluteEndOfBlock(
  anchor: PointType,
  boundaryNode: ElementNode,
): boolean {
  const anchorNode = anchor.getNode();

  if ($isTextNode(anchorNode)) {
    if (anchor.offset !== anchorNode.getTextContentSize()) return false;
  } else if ($isElementNode(anchorNode)) {
    if (anchor.offset !== anchorNode.getChildrenSize()) return false;
  }

  let currentNode: LexicalNode | null = anchorNode;
  while (
    currentNode !== null &&
    currentNode.getKey() !== boundaryNode.getKey()
  ) {
    if (currentNode.getNextSibling() !== null) {
      return false;
    }
    currentNode = currentNode.getParent();
  }
  return true;
}

/**
 * 通用块级逃逸插件：在表格单元格、代码块、引用等块级元素的最末尾
 * 按下方向键（↓）时，自动在块之后插入新段落并移动光标到其中，
 * 让用户能自然地从不可聚焦的块中“跳出”继续输入。
 */
export function UniversalBlockEscapePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown') return false;

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed())
          return false;

        const anchor = selection.anchor;

        // 自底向上探测节点层级结构
        let currentNode: LexicalNode | null = anchor.getNode();
        let tableCellNode: ElementNode | null = null;
        let tableRowNode: ElementNode | null = null;
        let tableNode: ElementNode | null = null;
        let trueTopLevelBlock: ElementNode | null = null;

        while (currentNode !== null) {
          const type = currentNode.getType();
          if (type === 'tablecell' || type === 'table-cell')
            tableCellNode = currentNode as ElementNode;
          if (type === 'tablerow' || type === 'table-row')
            tableRowNode = currentNode as ElementNode;
          if (type === 'table') tableNode = currentNode as ElementNode;

          const parent: LexicalNode | null = currentNode.getParent();
          if (parent !== null && parent.getType() === 'root') {
            trueTopLevelBlock = currentNode as ElementNode;
          }
          currentNode = parent;
        }

        if (!trueTopLevelBlock) return false;

        // 场景 A：光标处于 Table 网格内部
        if (tableNode && tableRowNode && tableCellNode) {
          const isLastRow = tableRowNode.getNextSibling() === null;
          if (!isLastRow) return false;

          if (!isAtAbsoluteEndOfBlock(anchor, tableCellNode)) return false;

          event.preventDefault();
          editor.update(() => {
            const newParagraph = $createParagraphNode();
            tableNode!.insertAfter(newParagraph);
            newParagraph.select();
          });
          return true;
        }

        // 场景 B：常规线性块（CodeBlock、Quote 等）
        if (trueTopLevelBlock.getNextSibling() !== null) return false;

        if (!isAtAbsoluteEndOfBlock(anchor, trueTopLevelBlock)) return false;

        event.preventDefault();
        editor.update(() => {
          const newParagraph = $createParagraphNode();
          trueTopLevelBlock!.insertAfter(newParagraph);
          newParagraph.select();
        });

        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
