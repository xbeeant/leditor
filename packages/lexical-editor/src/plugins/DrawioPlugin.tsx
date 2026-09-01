import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  createCommand,
} from 'lexical';
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { type DrawioElement, DrawioModal } from '../modals';
import { $createDrawioNode, $isDrawioNode, DrawioNode } from '../nodes';

/** 插入 Draw.io 图表命令，payload 为已有数据（编辑场景）或 undefined（新建） */
export const INSERT_DRAWIO_COMMAND: LexicalCommand<DrawioElement | undefined> =
  createCommand('INSERT_DRAWIO_COMMAND');

/**
 * Draw.io 插件：注册插入命令，打开 DrawioModal 让用户绘制，
 * 保存时将 DrawioNode 插入到当前选区位置。
 * 若选区已选中 DrawioNode，则更新该节点而非插入新节点。
 */
export function DrawioPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValue, setInitialValue] = useState<DrawioElement | undefined>(
    undefined,
  );
  // 跟踪当前正在编辑的节点，避免重复保存时持续插入新节点
  const editingNodeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor.hasNodes([DrawioNode])) {
      throw new Error('DrawioPlugin: DrawioNode 未在编辑器中注册');
    }
    return editor.registerCommand(
      INSERT_DRAWIO_COMMAND,
      (payload: DrawioElement | undefined) => {
        setInitialValue(payload);
        editingNodeKeyRef.current = null;
        setModalOpen(true);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  const onSave = (element: DrawioElement) => {
    editor.update(() => {
      // 若已跟踪到正在编辑的节点 key，更新该节点
      if (editingNodeKeyRef.current) {
        const node = $getNodeByKey(editingNodeKeyRef.current);
        if ($isDrawioNode(node)) {
          node.setData(element);
          return;
        }
      }
      // 尝试从选区查找 DrawioNode
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        if ($isDrawioNode(anchorNode)) {
          anchorNode.setData(element);
          editingNodeKeyRef.current = anchorNode.getKey();
          return;
        }
        for (const node of anchorNode.getParents()) {
          if ($isDrawioNode(node)) {
            node.setData(element);
            editingNodeKeyRef.current = node.getKey();
            return;
          }
        }
      }
      // 未找到现有节点，创建新节点
      const node = $createDrawioNode(element);
      $insertNodes([node]);
      if ($isRootOrShadowRoot(node.getParentOrThrow())) {
        $wrapNodeInElement(node, $createParagraphNode).selectEnd();
      }
      editingNodeKeyRef.current = node.getKey();
    });
  };

  return modalOpen ? (
    <DrawioModal
      initialValue={initialValue}
      isShown={modalOpen}
      onClose={() => {
        editingNodeKeyRef.current = null;
        setModalOpen(false);
      }}
      onSave={onSave}
    />
  ) : null;
}
