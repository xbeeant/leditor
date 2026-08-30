import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useRef, useState } from 'react';
import { $insertNodes } from 'lexical';
import { $createImageNode } from './ImageNode';
import { $createEquationNode } from './EquationNode';
import { EquationModal } from './EquationModal';
import { ImageModal } from './ImageModal';
import { SlashCommandPlugin } from './SlashCommandPlugin';
import { insertBlockAfter, insertBlockWithParagraphAfter } from './commands';

interface SlashCommandsHostProps {
  // 预留：可用于后续按 locale 本地化 slash 菜单文案
}

/**
 * 承载 slash 命令：管理公式/图片模态框状态，并把 SlashCommandPlugin
 * 触发的插入动作接入编辑器。拥有独立的 editor 上下文访问权限。
 */
export function SlashCommandsHost(_props: SlashCommandsHostProps) {  const [editor] = useLexicalComposerContext();

  const [equationOpen, setEquationOpen] = useState(false);
  const [equationInline, setEquationInline] = useState(false);
  const [equationCursor, setEquationCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [imageCursor, setImageCursor] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Slash-command 会移除斜杠文本、重置选区，导致光标位置丢失；
  // 保存触发时刻的浏览器选区范围，供模态框定位使用。
  const savedRangeRef = useRef<Range | null>(null);

  const captureCursor = useCallback((): { x: number; y: number } | null => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.bottom };
    }
    const editorRoot = editor.getRootElement();
    if (editorRoot) {
      const r = editorRoot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + 60 };
    }
    return null;
  }, [editor]);

  const openEquation = useCallback(
    (inline: boolean) => {
      setEquationCursor(captureCursor());
      setEquationInline(inline);
      setEquationOpen(true);
    },
    [captureCursor],
  );

  const openImage = useCallback(() => {
    setImageCursor(captureCursor());
    setImageOpen(true);
  }, [captureCursor]);

  const handleEquationConfirm = useCallback(
    (equation: string) => {
      if (equationInline) {
        // 行内公式：插入到当前光标（slash 移除后）位置，与周围文本同行
        editor.update(() => {
          $insertNodes([$createEquationNode(equation, true)]);
        });
        editor.focus();
      } else {
        // 块级公式：作为独立块插入当前行下方，并在其后追加正文段落
        insertBlockWithParagraphAfter(editor, () =>
          $createEquationNode(equation, false),
        );
      }
    },
    [editor],
  );

  const handleImageConfirm = useCallback(
    (src: string, altText: string) => {
      insertBlockAfter(editor, () => $createImageNode({ src, altText }));
    },
    [editor],
  );

  return (
    <>
      <SlashCommandPlugin
        onOpenEquation={openEquation}
        onOpenImage={openImage}
      />
      <EquationModal
        open={equationOpen}
        onClose={() => setEquationOpen(false)}
        onConfirm={handleEquationConfirm}
        title={equationInline ? '插入行内公式' : '插入公式'}
        cursorPosition={equationCursor}
      />
      <ImageModal
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onConfirm={handleImageConfirm}
        cursorPosition={imageCursor}
      />
    </>
  );
}
