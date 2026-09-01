import type { JSX } from 'react';
import { useEmbedConfig } from '../embed';
import { useMediaConfig } from '../media';
import { resolveMediaUrl } from '../media';

interface VideoComponentProps {
  src: string;
  width?: string;
  height?: string;
}

export function VideoComponent({
  src,
  width,
  height,
}: VideoComponentProps): JSX.Element {
  const embedConfig = useEmbedConfig();
  const mediaConfig = useMediaConfig();
  // 渲染/下载前经过 beforeDownload 和 getRealUrl 处理，得到可直接访问的地址
  const videoSrc = resolveMediaUrl(src, mediaConfig, embedConfig);

  return (
    <video
      src={videoSrc}
      controls
      preload="metadata"
      width={width ? Number.parseInt(width, 10) : undefined}
      height={height ? Number.parseInt(height, 10) : undefined}
      className="my-2 max-w-full rounded"
    />
  );
}
