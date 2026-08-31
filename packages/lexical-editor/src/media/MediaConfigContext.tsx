import type { JSX } from 'react';
import { createContext, useContext } from 'react';
import type { MediaConfig } from './config';

export const MediaConfigContext = createContext<MediaConfig | undefined>(
  undefined,
);

export function useMediaConfig(): MediaConfig | undefined {
  return useContext(MediaConfigContext);
}

export function MediaConfigProvider({
  config,
  children,
}: {
  config?: MediaConfig;
  children: JSX.Element;
}) {
  return (
    <MediaConfigContext.Provider value={config}>
      {children}
    </MediaConfigContext.Provider>
  );
}
