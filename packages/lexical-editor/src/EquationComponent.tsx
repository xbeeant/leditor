import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  type NodeKey,
  SELECTION_CHANGE_COMMAND,
  getActiveElement,
  mergeRegister,
} from 'lexical';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EquationEditor } from './EquationEditor';
import { EquationModal } from './EquationModal';
import { $isEquationNode } from './EquationNode';
import { t } from './i18n';
import { KatexRenderer } from './KatexRenderer';
import { useLocale } from './LocaleContext';

interface EquationComponentProps {
  equation: string;
  inline: boolean;
  nodeKey: NodeKey;
}

export function EquationComponent({
  equation,
  inline,
  nodeKey,
}: EquationComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const isEditable = useLexicalEditable();
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [equationValue, setEquationValue] = useState(equation);
  const [showEquationEditor, setShowEquationEditor] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [modalCursorPosition, setModalCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const onClick = useCallback(
    (event: MouseEvent) => {
      const dom = editor.getElementByKey(nodeKey);
      if (dom === null || !dom.contains(event.target as Node)) {
        return false;
      }
      if (event.shiftKey) {
        setSelected(!isSelected);
      } else {
        clearSelection();
        setSelected(true);
      }
      return true;
    },
    [clearSelection, editor, isSelected, nodeKey, setSelected],
  );

  useEffect(() => {
    return editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW);
  }, [editor, onClick]);

  const $onEnter = useCallback(
    (event: null | KeyboardEvent) => {
      const latestSelection = $getSelection();
      if (
        !(
          $isNodeSelection(latestSelection) &&
          latestSelection.has(nodeKey) &&
          latestSelection.getNodes().length === 1
        )
      ) {
        return false;
      }
      const node = $getNodeByKey(nodeKey);
      if (!$isEquationNode(node)) {
        return false;
      }
      if (node.isInline()) {
        const parent = node.getParent();
        if (!$isElementNode(parent)) {
          return false;
        }
        const paragraph = $createParagraphNode();
        parent.insertAfter(paragraph);
        paragraph.select();
      } else {
        const paragraph = $createParagraphNode();
        node.insertAfter(paragraph);
        paragraph.select();
      }
      event?.preventDefault();
      return true;
    },
    [nodeKey],
  );

  useEffect(() => {
    if (!isEditable) {
      return undefined;
    }
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      $onEnter,
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, isEditable, $onEnter]);

  const onDeleteEmpty = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isEquationNode(node)) {
        return;
      }
      if (node.isInline()) {
        $setSelection(null);
        node.remove(true);
        return;
      }
      const prevSibling = node.getPreviousSibling();
      if ($isElementNode(prevSibling)) {
        node.remove();
        prevSibling.selectEnd();
        return;
      }
      const paragraph = $createParagraphNode();
      node.replace(paragraph);
      paragraph.select();
    });
  }, [editor, nodeKey]);

  useEffect(() => {
    const dom = editor.getElementByKey(nodeKey);
    if (dom === null) {
      return;
    }
    if (isSelected && isEditable) {
      dom.classList.add('focused');
    } else {
      dom.classList.remove('focused');
    }
  }, [editor, nodeKey, isSelected, isEditable]);

  const onHide = useCallback(
    (restoreSelection?: boolean) => {
      setShowEquationEditor(false);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEquationNode(node)) {
          node.setEquation(equationValue);
          if (restoreSelection) {
            node.selectNext(0, 0);
          }
        }
      });
    },
    [editor, equationValue, nodeKey],
  );

  // 双击公式打开编辑模态框
  const openEditModal = useCallback(() => {
    if (!isEditable) return;
    const dom = editor.getElementByKey(nodeKey);
    let pos: { x: number; y: number } | null = null;
    if (dom) {
      const rect = dom.getBoundingClientRect();
      pos = { x: rect.left + rect.width / 2, y: rect.bottom };
    }
    setModalCursorPosition(pos);
    setShowEquationModal(true);
  }, [editor, isEditable, nodeKey]);

  const closeEditModal = useCallback(() => {
    setShowEquationModal(false);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEquationNode(node)) {
        const selection = $createNodeSelection();
        selection.add(nodeKey);
        $setSelection(selection);
      }
    });
    editor.focus();
  }, [editor, nodeKey]);

  const confirmEditModal = useCallback(
    (newEquation: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isEquationNode(node)) {
          node.setEquation(newEquation);
        }
      });
      setEquationValue(newEquation);
    },
    [editor, nodeKey],
  );

  useEffect(() => {
    if (!showEquationEditor && equationValue !== equation) {
      setEquationValue(equation);
    }
  }, [showEquationEditor, equation, equationValue]);

  useEffect(() => {
    if (!isEditable) {
      return;
    }
    if (showEquationEditor) {
      return mergeRegister(
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            const inputElem = inputRef.current;
            const activeElement = inputElem
              ? getActiveElement(inputElem)
              : null;
            if (inputElem !== activeElement) {
              onHide();
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
        editor.registerCommand(
          KEY_ESCAPE_COMMAND,
          () => {
            const inputElem = inputRef.current;
            const activeElement = inputElem
              ? getActiveElement(inputElem)
              : null;
            if (inputElem === activeElement) {
              onHide(true);
              return true;
            }
            return false;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      );
    }
    return undefined;
  }, [editor, nodeKey, onHide, showEquationEditor, isEditable]);

  return (
    <>
      {showEquationEditor && isEditable ? (
        <EquationEditor
          equation={equationValue}
          setEquation={setEquationValue}
          inline={inline}
          onDeleteEmpty={onDeleteEmpty}
          ref={inputRef}
        />
      ) : (
        <LexicalErrorBoundary
          onError={(e) => editor._onError(e)}
          fallback={null}
        >
          <KatexRenderer
            equation={equationValue}
            inline={inline}
            onDoubleClick={openEditModal}
          />
        </LexicalErrorBoundary>
      )}
      <EquationModal
        open={showEquationModal}
        onClose={closeEditModal}
        onConfirm={confirmEditModal}
        initialEquation={equationValue}
        title={t(locale, 'editEquation')}
        cursorPosition={modalCursorPosition}
      />
    </>
  );
}
