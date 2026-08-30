import katex from 'katex';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

interface KatexRendererProps {
  equation: string;
  inline: boolean;
  onDoubleClick: () => void;
}

export function KatexRenderer({
  equation,
  inline,
  onDoubleClick,
}: KatexRendererProps): JSX.Element {
  const katexElementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const katexElement = katexElementRef.current;

    if (katexElement !== null) {
      katex.render(equation, katexElement, {
        displayMode: !inline,
        errorColor: '#cc0000',
        output: 'html',
        strict: 'warn',
        throwOnError: false,
        trust: false,
      });
    }
  }, [equation, inline]);

  return (
    <span onDoubleClick={onDoubleClick} ref={katexElementRef} />
  );
}
