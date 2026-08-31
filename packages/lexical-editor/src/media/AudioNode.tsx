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
import { AudioComponent } from './AudioComponent';

export interface AudioPayload {
  src: string;
  key?: NodeKey;
}

export type SerializedAudioNode = Spread<
  {
    src: string;
  },
  SerializedLexicalNode
>;

export class AudioNode extends DecoratorNode<JSX.Element> {
  __src: string;

  static getType(): string {
    return 'audio';
  }

  static clone(node: AudioNode): AudioNode {
    return new AudioNode(node.__src, node.__key);
  }

  constructor(src: string, key?: NodeKey) {
    super(key);
    this.__src = src;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportJSON(): SerializedAudioNode {
    return {
      src: this.__src,
      type: 'audio',
      version: 1,
    };
  }

  static importJSON(serialized: SerializedAudioNode): AudioNode {
    return $createAudioNode({ src: serialized.src });
  }

  getSrc(): string {
    return this.__src;
  }

  setSrc(src: string): void {
    const writable = this.getWritable() as AudioNode;
    writable.__src = src;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <AudioComponent src={this.__src} />;
  }
}

export function $createAudioNode(payload: AudioPayload): AudioNode {
  return new AudioNode(payload.src, payload.key);
}

export function $isAudioNode(
  node: LexicalNode | null | undefined,
): node is AudioNode {
  return node instanceof AudioNode;
}
