import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { type MindElements, MindModal } from '../modals';
import { $isMindNode } from '../nodes';
import { type Dimension, ResizableContainer } from '../ui';

/**
 * 思维导图节点的渲染组件：以 <img> 展示已保存的 PNG，
 * 支持选中后 8 向手柄拉伸宽高。
 * 双击 / 点击编辑按钮重新打开 MindModal。
 */
export default function MindComponent({
  nodeKey,
  data,
  width,
  height,
}: {
  nodeKey: NodeKey;
  data: MindElements;
  width: Dimension;
  height: Dimension;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [modalOpen, setModalOpen] = useState(false);

  const deleteNode = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setModalOpen(false);
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          node?.remove();
        });
      }
    },
    [editor, nodeKey],
  );

  const handleSave = useCallback(
    (els: MindElements) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isMindNode(node)) {
          if (els.png || Object.keys(els.json ?? {}).length > 0) {
            node.setData(els);
          } else {
            node.remove();
          }
        }
      });
    },
    [editor, nodeKey],
  );

  const onResizeEnd = useCallback(
    (w: number, h: number) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isMindNode(node)) {
          node.setWidth(w);
          node.setHeight(h);
        }
      });
    },
    [editor, nodeKey],
  );

  return (
    <>
      {modalOpen && (
        <MindModal
          initialValue={data}
          isShown={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
      <ResizableContainer
        nodeKey={nodeKey}
        width={width}
        height={height}
        onResizeEnd={onResizeEnd}
        onKeyDown={deleteNode}
        renderOverlay={(interactive) =>
          interactive ? (
            <button
              type="button"
              tabIndex={0}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setModalOpen(true)}
              className="absolute top-1 right-1 z-10 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
            >
              编辑
            </button>
          ) : null
        }
      >
        {data.png ? (
          <img
            src={data.png}
            alt="mind"
            className="block max-w-full"
            draggable={false}
          />
        ) : (
          <div className="flex h-24 w-48 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
            空白思维导图
          </div>
        )}
      </ResizableContainer>
    </>
  );
}
