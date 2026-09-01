import { $isCodeNode } from '@lexical/code-core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  type PasteCommandType,
  PASTE_COMMAND,
} from 'lexical';
import { useEffect } from 'react';

/**
 * 代码块粘贴拦截插件：当光标位于代码块（CodeNode）内部时，
 * 将粘贴内容强制作为纯文本插入，避免破坏代码块的块级结构。
 */
export function CodePastePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      PASTE_COMMAND,
      (event: PasteCommandType) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;

        const anchorNode = selection.anchor.getNode();
        const topLevelElement = anchorNode.getTopLevelElementOrThrow();

        // 仅在代码块内部拦截
        if (!$isCodeNode(topLevelElement)) return false;

        event.preventDefault();
        const clipboardData = (event as ClipboardEvent).clipboardData;
        const text = clipboardData?.getData('text/plain');
        if (text) {
          editor.update(() => {
            selection.insertText(text);
          });
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
