import type { JSX } from 'react';

interface ImageComponentProps {
  src: string;
  altText: string;
  width?: string;
  height?: string;
}

export function ImageComponent({
  src,
  altText,
  width,
  height,
}: ImageComponentProps): JSX.Element {
  return (
    <img
      src={src}
      alt={altText}
      width={width ? Number.parseInt(width, 10) : undefined}
      height={height ? Number.parseInt(height, 10) : undefined}
      className="my-2 max-w-full rounded"
      draggable={false}
    />
  );
}
