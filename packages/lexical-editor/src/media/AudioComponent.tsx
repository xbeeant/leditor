import type { JSX } from 'react';
import { useMediaConfig } from './MediaConfigContext';
import { resolveMediaUrl } from './upload';

interface AudioComponentProps {
  src: string;
}

export function AudioComponent({ src }: AudioComponentProps): JSX.Element {
  const config = useMediaConfig();
  // 渲染/下载前经过 beforeDownload 处理，得到可直接访问的地址
  const audioSrc = resolveMediaUrl(src, config);
  return (
    <audio src={audioSrc} controls preload="metadata" className="my-2 w-full" />
  );
}
