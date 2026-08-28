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

export interface RubyPayload {
  text: string;
  annotation: string;
  key?: NodeKey;
}

export type SerializedRubyNode = Spread<
  {
    text: string;
    annotation: string;
  },
  SerializedLexicalNode
>;

function RubyComponent({
  text,
  annotation,
}: {
  text: string;
  annotation: string;
}): JSX.Element {
  return (
    <ruby className="cursor-text">
      {text}
      <rt className="text-[0.6em] text-gray-500">{annotation}</rt>
    </ruby>
  );
}

export class RubyNode extends DecoratorNode<JSX.Element> {
  __text: string;
  __annotation: string;

  static getType(): string {
    return 'ruby';
  }

  static clone(node: RubyNode): RubyNode {
    return new RubyNode(node.__text, node.__annotation, node.__key);
  }

  constructor(text: string, annotation: string, key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__annotation = annotation;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('span');
  }

  updateDOM(): false {
    return false;
  }

  exportJSON(): SerializedRubyNode {
    return {
      text: this.__text,
      annotation: this.__annotation,
      type: 'ruby',
      version: 1,
    };
  }

  static importJSON(serialized: SerializedRubyNode): RubyNode {
    return $createRubyNode({
      text: serialized.text,
      annotation: serialized.annotation,
    });
  }

  getText(): string {
    return this.__text;
  }

  setText(text: string): void {
    const writable = this.getWritable();
    writable.__text = text;
  }

  getAnnotation(): string {
    return this.__annotation;
  }

  setAnnotation(annotation: string): void {
    const writable = this.getWritable();
    writable.__annotation = annotation;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return <RubyComponent text={this.__text} annotation={this.__annotation} />;
  }
}

export function $createRubyNode(payload: RubyPayload): RubyNode {
  return new RubyNode(payload.text, payload.annotation, payload.key);
}

export function $isRubyNode(
  node: LexicalNode | null | undefined,
): node is RubyNode {
  return node instanceof RubyNode;
}
