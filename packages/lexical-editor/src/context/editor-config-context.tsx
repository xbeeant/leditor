import type { JSX } from 'react';
import { createContext, useContext } from 'react';
import {
  DEFAULT_DRAWIO_URL,
  type EmbedConfig,
  type EmbedServiceConfig,
} from '../embed';
import type { MediaConfig } from '../media';

/**
 * 编辑器模式：
 * - `edit`：编辑模式（默认）。若文档含模板标记（模板字段），则仅可填写字段、
 *   固定内容锁定；若为普通文档则完全自由编辑。
 * - `readonly`：只读模式（查看），内容不可编辑。
 * - `design`：模板设计模式，可自由编辑内容并圈定「固定 / 可填写」区域。
 */
export type EditorMode = 'edit' | 'readonly' | 'design';

export type EditorConfig =
  | {
      embed?: EmbedConfig;
      media?: MediaConfig;
      mode?: EditorMode;
    }
  | undefined;

export const EditorConfigContext = createContext<EditorConfig>(undefined);

export function useEditorConfig(): EditorConfig {
  return useContext(EditorConfigContext);
}

/** 获取当前编辑器模式。未显式配置时所有没有模式字段的组件默认视作 `edit`。 */
export function useEditorMode(): EditorMode {
  const config = useContext(EditorConfigContext);
  return config?.mode ?? 'edit';
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
  mode,
  children,
}: {
  embed?: EmbedConfig;
  media?: MediaConfig;
  mode?: EditorMode;
  children: JSX.Element;
}) {
  return (
    <EditorConfigContext.Provider value={{ embed, media, mode }}>
      {children}
    </EditorConfigContext.Provider>
  );
}
