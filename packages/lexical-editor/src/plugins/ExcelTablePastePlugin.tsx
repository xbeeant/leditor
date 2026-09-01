import { $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  PASTE_COMMAND,
  type PasteCommandType,
} from 'lexical';
import { useEffect } from 'react';

// 从 Excel 的内联样式表提取类名到背景色的映射
function preProcessExcelDOM(dom: Document): Document {
  const styleElements = dom.querySelectorAll('style');
  const classToBgColor: Record<string, string> = {};

  const regex =
    /\.([a-zA-Z0-9_-]+)\s*\{[^}]*background(?:-color)?:\s*([^;!}]+)(?:!important)?[^}]*}/gi;

  for (const styleEl of styleElements) {
    const cssText = styleEl.textContent || '';
    for (const match of cssText.matchAll(regex)) {
      const className = match[1];
      const bgColor = match[2]?.trim();
      if (className && bgColor) {
        classToBgColor[className] = bgColor;
      }
    }
  }

  // 将匹配到的类名样式写为内联背景色
  const cells = dom.querySelectorAll('td, th');
  for (const cell of cells) {
    if (!(cell as HTMLElement).style.backgroundColor) {
      const classNames = (cell as HTMLElement).className
        .split(/\s+/)
        .filter(Boolean);
      for (const cls of classNames) {
        if (classToBgColor[cls]) {
          (cell as HTMLElement).style.backgroundColor = classToBgColor[cls];
          break;
        }
      }
    }
  }

  return dom;
}

/**
 * Excel 表格粘贴插件：拦截从 Excel 复制的表格数据，
 * 解析其 HTML 结构与背景色，生成为 Lexical 表格节点插入。
 */
export function ExcelTablePastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: PasteCommandType) => {
        if (!(event instanceof ClipboardEvent)) return false;
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        if (clipboardData.types.includes('application/x-lexical-editor')) {
          return false;
        }

        const html = clipboardData.getData('text/html');
        if (!html) return false;

        const isTableHtml = /<table[\s>]/i.test(html);
        // Excel 导出的 HTML 通常带有该命名空间标记
        const isFromExcel = html.includes(
          'urn:schemas-microsoft-com:office:excel',
        );

        if (!(isTableHtml && isFromExcel)) return false;

        event.preventDefault();

        editor.update(() => {
          const parser = new DOMParser();
          const rawDom = parser.parseFromString(html, 'text/html');
          const processedDom = preProcessExcelDOM(rawDom);

          const nodes = $generateNodesFromDOM(editor, processedDom);

          const selection = $getSelection();
          if (selection && $isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            $getRoot().append(...nodes);
          }
        });

        // 在最终插入的表格后追加一个段落，便于继续输入
        editor.update(() => {
          const allTables = $getRoot()
            .getChildren()
            .filter((node) => node.getType() === 'table');
          const newTableNode = allTables[allTables.length - 1];
          if (newTableNode) {
            const newParagraph = $createParagraphNode();
            newTableNode.insertAfter(newParagraph);
            newParagraph.selectStart();
          }
        });

        return true;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  return null;
}
