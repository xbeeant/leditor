import type { ReactNode } from 'react';

interface ToolbarButtonProps {
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function ToolbarButton({
  title,
  onClick,
  active = false,
  disabled = false,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-700',
        'transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        active ? 'bg-blue-50 text-blue-600' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
