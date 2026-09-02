import type { JSX } from 'react';
import { createContext, useContext } from 'react';
import {
  DEFAULT_DRAWIO_URL,
  type EmbedConfig,
  type EmbedServiceConfig,
} from '../embed';
import type { MediaConfig } from '../media';

export type EditorConfig =
  | ({ embed?: EmbedConfig } & {
      media?: MediaConfig;
    })
  | undefined;

export const EditorConfigContext = createContext<EditorConfig>(undefined);

export function useEditorConfig(): EditorConfig {
  return useContext(EditorConfigContext);
}

/** 获取 Draw.io 嵌入服务配置，未显式配置时回退到公共嵌入服务 */
export function useDrawioConfig(): EmbedServiceConfig {
  const config = useContext(EditorConfigContext);
  return config?.embed?.drawio ?? { url: DEFAULT_DRAWIO_URL };
}

/** 获取思维导图嵌入服务配置，未配置时返回 undefined（功能不可用） */
export function useMindConfig(): EmbedServiceConfig | undefined {
  const config = useContext(EditorConfigContext);
  return config?.embed?.mind;
}

/**
 * 获取媒体上传/下载配置。
 * 从合并后的 context 中读取 media 属性。
 */
export function useMediaConfig(): MediaConfig | undefined {
  const config = useContext(EditorConfigContext);
  return config?.media;
}

export function EditorConfigProvider({
  embed,
  media,
  children,
}: {
  embed?: EmbedConfig;
  media?: MediaConfig;
  children: JSX.Element;
}) {
  return (
    <EditorConfigContext.Provider value={{ embed, media }}>
      {children}
    </EditorConfigContext.Provider>
  );
}
