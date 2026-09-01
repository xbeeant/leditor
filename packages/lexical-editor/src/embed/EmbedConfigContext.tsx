import type { JSX } from 'react';
import { createContext, useContext } from 'react';
import {
  DEFAULT_DRAWIO_URL,
  type EmbedConfig,
  type EmbedServiceConfig,
} from './config';

export const EmbedConfigContext = createContext<EmbedConfig | undefined>(
  undefined,
);

export function useEmbedConfig(): EmbedConfig | undefined {
  return useContext(EmbedConfigContext);
}

/** 获取 Draw.io 嵌入服务配置，未显式配置时回退到公共嵌入服务 */
export function useDrawioConfig(): EmbedServiceConfig {
  const config = useContext(EmbedConfigContext);
  return config?.drawio ?? { url: DEFAULT_DRAWIO_URL };
}

/** 获取思维导图嵌入服务配置，未配置时返回 undefined（功能不可用） */
export function useMindConfig(): EmbedServiceConfig | undefined {
  const config = useContext(EmbedConfigContext);
  return config?.mind;
}

export function EmbedConfigProvider({
  config,
  children,
}: {
  config?: EmbedConfig;
  children: JSX.Element;
}) {
  return (
    <EmbedConfigContext.Provider value={config}>
      {children}
    </EmbedConfigContext.Provider>
  );
}
