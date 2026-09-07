import type { JSX } from 'react';
import { useEditorConfig } from '../context';
import { resolveMediaUrl } from '../media';

interface AudioComponentProps {
  src: string;
}

export function AudioComponent({ src }: AudioComponentProps): JSX.Element {
  const editorConfig = useEditorConfig();
  // 渲染/下载前经过 beforeDownload 和 getRealUrl 处理，得到可直接访问的地址
  const audioSrc = resolveMediaUrl(src, editorConfig);

  return (
    <audio src={audioSrc} controls preload="metadata" className="my-2 w-full" />
  );
}
