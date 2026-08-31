import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { VideoComponent } from './VideoComponent';

export interface VideoPayload {
  src: string;
  width?: string;
  height?: string;
  key?: NodeKey;
}

export type SerializedVideoNode = Spread<
  {
    src: string;
    width?: string;
    height?: string;
  },
  SerializedLexicalNode
>;

export class VideoNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __width?: string;
  __height?: string;

  static getType(): string {
    return 'video';
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(node.__src, node.__width, node.__height, node.__key);
  }

  constructor(src: string, width?: string, height?: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__width = width;
    this.__height = height;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportJSON(): SerializedVideoNode {
    return {
      src: this.__src,
      width: this.__width,
      height: this.__height,
      type: 'video',
      version: 1,
    };
  }

  static importJSON(serialized: SerializedVideoNode): VideoNode {
    return $createVideoNode({
      src: serialized.src,
      width: serialized.width,
      height: serialized.height,
    });
  }

  getSrc(): string {
    return this.__src;
  }

  setSrc(src: string): void {
    const writable = this.getWritable() as VideoNode;
    writable.__src = src;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <VideoComponent
        src={this.__src}
        width={this.__width}
        height={this.__height}
      />
    );
  }
}

export function $createVideoNode(payload: VideoPayload): VideoNode {
  return new VideoNode(payload.src, payload.width, payload.height, payload.key);
}

export function $isVideoNode(
  node: LexicalNode | null | undefined,
): node is VideoNode {
  return node instanceof VideoNode;
}
