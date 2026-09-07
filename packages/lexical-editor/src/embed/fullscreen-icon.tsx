import type { JSX } from 'react';

/** 模态框全屏 / 还原切换图标 */
export function FullscreenIcon({
  fullscreen,
}: {
  fullscreen: boolean;
}): JSX.Element {
  return fullscreen ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 1v3a1 1 0 0 1-1 1H1M11 1v3a1 1 0 0 0 1 1h3M5 15v-3a1 1 0 0 0-1-1H1M11 15v-3a1 1 0 0 1 1-1h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 1h4a2 2 0 0 1 2 2v4M7 15H3a2 2 0 0 1-2-2V9M15 9v4a2 2 0 0 1-2 2H9M1 7V3a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
