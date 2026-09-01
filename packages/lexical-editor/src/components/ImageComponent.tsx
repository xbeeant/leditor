import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { type JSX, useCallback } from 'react';
import { useEmbedConfig } from '../embed';
import { useMediaConfig } from '../media';
import { resolveMediaUrl } from '../media';
import { $isImageNode } from '../nodes';
import { ResizableContainer } from '../ui';

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
  const embedConfig = useEmbedConfig();
  const mediaConfig = useMediaConfig();
  // 渲染/下载前经过 beforeDownload 和 getRealUrl 处理，得到可直接访问的地址
  const displaySrc = resolveMediaUrl(src, mediaConfig, embedConfig);

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

  return (
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
      />
    </ResizableContainer>
  );
}
