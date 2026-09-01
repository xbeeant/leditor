import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { type DrawioElement, DrawioModal } from '../modals';
import { $isDrawioNode } from '../nodes';
import { type Dimension, ResizableContainer } from '../ui';

/**
 * Draw.io 节点的渲染组件：将已保存的 SVG 内联渲染到 DOM，
 * 支持选中后 8 向手柄拉伸宽高。
 * 直接 innerHTML 渲染而非 <img> 是因为 drawio 导出的 SVG 常含
 * <foreignObject> 文本标签，<img> 渲染时会被浏览器安全策略屏蔽。
 * 双击 / 点击编辑按钮重新打开 DrawioModal。
 */
export default function DrawioComponent({
  nodeKey,
  data,
  width,
  height,
}: {
  nodeKey: NodeKey;
  data: DrawioElement;
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
    (els: DrawioElement) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isDrawioNode(node)) {
          if (els.src || els.xml) {
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
        if ($isDrawioNode(node)) {
          node.setWidth(w);
          node.setHeight(h);
        }
      });
    },
    [editor, nodeKey],
  );

  const src = data.src ?? '';
  // data: 开头为旧版 data URL（回退为 <img>）；< 开头为原始 SVG，内联渲染
  const isRawSvg = src.startsWith('<');

  return (
    <>
      {modalOpen && (
        <DrawioModal
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
        {src ? (
          isRawSvg ? (
            // 内联渲染原始 SVG：foreignObject 文本可正常显示；
            // svg 填满容器以便边拖拽时宽高独立生效
            <div
              className="max-w-full overflow-hidden [&_svg]:h-full [&_svg]:w-full"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: drawio 导出的 SVG 为可信内容，保存前已清理 XML 声明
              dangerouslySetInnerHTML={{ __html: src }}
            />
          ) : (
            <img
              src={src}
              alt="drawio"
              className="block max-w-full"
              draggable={false}
            />
          )
        ) : (
          <div className="flex h-24 w-48 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
            空白 Draw.io 图表
          </div>
        )}
      </ResizableContainer>
    </>
  );
}
