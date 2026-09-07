import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { type JSX, useCallback, useRef, useState } from 'react';
import { useEditorConfig } from '../context';
import { resolveMediaUrl } from '../media';
import { $isImageNode } from '../nodes';
import { ImageViewer, ResizableContainer } from '../ui';

interface ImageComponentProps {
  src: string;
  altText: string;
  width?: string;
  height?: string;
  /** 所属 ImageNode 的 key，用于缩放后写回尺寸 */
  nodeKey: NodeKey;
}

function parsePx(value?: string): number | 'inherit' {
  if (!value) return 'inherit';
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 'inherit' : n;
}

export function ImageComponent({
  src,
  altText,
  width,
  height,
  nodeKey,
}: ImageComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const editorConfig = useEditorConfig();
  // 渲染/下载前经过 beforeDownload 和 getRealUrl 处理，得到可直接访问的地址
  const displaySrc = resolveMediaUrl(src, editorConfig);

  const onResizeEnd = useCallback(
    (w: number, h: number) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setWidth(`${w}px`);
          node.setHeight(`${h}px`);
        }
      });
    },
    [editor, nodeKey],
  );

  // 全屏预览状态：组件内部管理，类似 CodeDrawing 的实现模式
  const [viewer, setViewer] = useState<{
    src: string;
    srcs: string[];
  } | null>(null);
  // 容器 ref，用于双击时查找同容器内的所有图片
  const containerRef = useRef<HTMLDivElement>(null);

  // 双击图片打开预览：收集同编辑器容器内的所有图片作为导航列表
  const onDoubleClick = useCallback(() => {
    const container = containerRef.current?.closest(
      '.overflow-y-auto',
    ) as HTMLElement | null;
    if (!container) return;

    // 收集当前容器内所有图片的 src
    const allImgs = Array.from(
      container.querySelectorAll<HTMLImageElement>('img'),
    );
    const srcs = allImgs
      .map((img) => img.currentSrc || img.src)
      .filter((src): src is string => Boolean(src) && src !== 'data:,');

    if (srcs.length > 0) {
      setViewer({ src: displaySrc, srcs });
    }
  }, [displaySrc]);

  return (
    <>
      <ResizableContainer
        nodeKey={nodeKey}
        width={parsePx(width)}
        height={parsePx(height)}
        onResizeEnd={onResizeEnd}
        containerClassName="my-2"
      >
        <img
          src={displaySrc}
          alt={altText}
          className="block max-w-full rounded"
          draggable={false}
          onDoubleClick={onDoubleClick}
        />
      </ResizableContainer>
      {viewer && (
        <ImageViewer
          src={viewer.src}
          srcs={viewer.srcs}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
