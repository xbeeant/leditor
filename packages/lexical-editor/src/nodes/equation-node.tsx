import katex from 'katex';
import {
  type DOMExportOutput,
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { EquationComponent } from '../components';

export type SerializedEquationNode = Spread<
  {
    equation: string;
    inline: boolean;
  },
  SerializedLexicalNode
>;

export function encodeEquation(equation: string): string {
  const bytes = new TextEncoder().encode(equation);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeEquation(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export class EquationNode extends DecoratorNode<JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return 'equation';
  }

  static clone(node: EquationNode): EquationNode {
    return new EquationNode(node.__equation, node.__inline, node.__key);
  }

  constructor(equation = '', inline?: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline ?? false;
  }

  static importJSON(serializedNode: SerializedEquationNode): EquationNode {
    return $createEquationNode(serializedNode.equation, serializedNode.inline);
  }

  exportJSON(): SerializedEquationNode {
    return {
      equation: this.getEquation(),
      inline: this.isInline(),
      type: 'equation',
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    element.className = 'editor-equation';
    element.setAttribute('data-lexical-inline', `${this.__inline}`);
    element.setAttribute('role', 'math');
    element.setAttribute('aria-label', `Equation: ${this.getEquation()}`);
    return element;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    const equation = encodeEquation(this.__equation);
    element.setAttribute('data-lexical-equation', equation);
    element.setAttribute('data-lexical-inline', `${this.__inline}`);
    katex.render(this.__equation, element, {
      displayMode: !this.__inline,
      errorColor: '#cc0000',
      output: 'html',
      strict: 'warn',
      throwOnError: false,
      trust: false,
    });
    element.setAttribute('role', 'math');
    element.setAttribute('aria-label', `Equation: ${this.__equation}`);
    return { element };
  }

  updateDOM(prevNode: this, dom: HTMLElement): boolean {
    if (this.__inline !== prevNode.__inline) {
      return true;
    }
    if (this.__equation !== prevNode.__equation) {
      dom.setAttribute('aria-label', `Equation: ${this.getEquation()}`);
    }
    return false;
  }

  getTextContent(): string {
    return this.getEquation();
  }

  isInline(): boolean {
    return this.getLatest().__inline;
  }

  getEquation(): string {
    return this.getLatest().__equation;
  }

  setEquation(equation: string): this {
    const writable = this.getWritable();
    writable.__equation = equation;
    return writable;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <EquationComponent
        equation={this.__equation}
        inline={this.__inline}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createEquationNode(
  equation = '',
  inline = false,
): EquationNode {
  const equationNode = new EquationNode(equation, inline);
  return equationNode;
}

export function $isEquationNode(
  node: LexicalNode | null | undefined,
): node is EquationNode {
  return node instanceof EquationNode;
}
