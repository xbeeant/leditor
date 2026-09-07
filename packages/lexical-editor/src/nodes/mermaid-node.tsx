import {
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { MermaidComponent } from '../components';

export type SerializedMermaidNode = Spread<
  { code: string },
  SerializedLexicalNode
>;

/**
 * Mermaid 图表节点：存储 Mermaid 语法源码，通过 decorator 渲染图表。
 * 编辑模式下展示代码编辑器 + 实时预览；只读模式下渲染为图表。
 */
export class MermaidNode extends DecoratorNode<JSX.Element> {
  __code: string;

  static override getType(): string {
    return 'mermaid';
  }

  static override clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__code, node.__key);
  }

  constructor(code: string, key?: NodeKey) {
    super(key);
    this.__code = code;
  }

  getCode(): string {
    return this.__code;
  }

  setCode(code: string): void {
    const writable = this.getWritable();
    writable.__code = code;
  }

  override createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.style.display = 'block';
    return div;
  }

  override updateDOM(): boolean {
    return false;
  }

  static override importJSON(
    serializedNode: SerializedMermaidNode,
  ): MermaidNode {
    return new MermaidNode(serializedNode.code);
  }

  override exportJSON(): SerializedMermaidNode {
    return {
      type: 'mermaid',
      version: 1,
      code: this.getCode(),
    };
  }

  override decorate(): JSX.Element {
    return <MermaidComponent nodeKey={this.getKey()} code={this.__code} />;
  }
}

export function $createMermaidNode(code: string): MermaidNode {
  return new MermaidNode(code);
}

export function $isMermaidNode(
  node: LexicalNode | null | undefined,
): node is MermaidNode {
  return node instanceof MermaidNode;
}
