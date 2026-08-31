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
import { CodeDrawing } from './ui/CodeDrawing';

export type CodeDrawingType = 'mermaid' | 'plantuml' | 'graphviz' | 'flowchart';
export type CodeDrawingMode = 'both' | 'code' | 'img';

export type SerializedCodeDrawingNode = Spread<
  {
    drawingType: CodeDrawingType;
    drawingMode: CodeDrawingMode;
    data: string;
  },
  SerializedLexicalNode
>;

export class CodeDrawingNode extends DecoratorNode<JSX.Element> {
  __data: string;
  __drawingType: CodeDrawingType;
  __drawingMode: CodeDrawingMode;

  static override getType(): string {
    return 'code-drawing';
  }

  static override clone(node: CodeDrawingNode): CodeDrawingNode {
    return new CodeDrawingNode(
      node.__data,
      node.__drawingType,
      node.__drawingMode,
      node.__key,
    );
  }

  static override importJSON(
    serializedNode: SerializedCodeDrawingNode,
  ): CodeDrawingNode {
    const node = new CodeDrawingNode(
      serializedNode.data,
      serializedNode.drawingType ?? 'mermaid',
      serializedNode.drawingMode ?? 'both',
    );
    return node.updateFromJSON(serializedNode);
  }

  override exportJSON(): SerializedCodeDrawingNode {
    return {
      ...super.exportJSON(),
      data: this.__data,
      drawingType: this.__drawingType,
      drawingMode: this.__drawingMode,
    };
  }

  constructor(
    data = '',
    drawingType: CodeDrawingType = 'mermaid',
    drawingMode: CodeDrawingMode = 'both',
    key?: NodeKey,
  ) {
    super(key);
    this.__data = data;
    this.__drawingMode = drawingMode;
    this.__drawingType = drawingType;
  }

  override createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  override updateDOM(): false {
    return false;
  }

  override exportDOM(editor: LexicalEditor): { element: HTMLElement } {
    const element = document.createElement('span');
    element.style.display = 'inline-block';

    const content = editor.getElementByKey(this.getKey());
    if (content !== null) {
      const svg = content.querySelector('svg');
      if (svg !== null) {
        element.innerHTML = svg.outerHTML;
      }
    }

    element.setAttribute('data-lexical-code-drawing-json', this.__data);
    return { element };
  }

  setData(data: string): void {
    const self = this.getWritable();
    self.__data = data;
  }

  getDrawingType(): CodeDrawingType {
    return this.getLatest().__drawingType;
  }

  setDrawingType(drawingType: CodeDrawingType): void {
    const self = this.getWritable();
    self.__drawingType = drawingType;
  }

  getDrawingMode(): CodeDrawingMode {
    return this.getLatest().__drawingMode;
  }

  setDrawingMode(drawingMode: CodeDrawingMode): void {
    const self = this.getWritable();
    self.__drawingMode = drawingMode;
  }

  override decorate(
    _editor: LexicalEditor,
    _config: EditorConfig,
  ): JSX.Element {
    return (
      <CodeDrawing
        nodeKey={this.getKey()}
        data={this.__data}
        drawingType={this.__drawingType}
        drawingMode={this.__drawingMode}
      />
    );
  }

  override isInline(): boolean {
    return false;
  }

  override isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $createCodeDrawingNode(
  data = '',
  drawingType: CodeDrawingType = 'mermaid',
  drawingMode: CodeDrawingMode = 'both',
): CodeDrawingNode {
  return new CodeDrawingNode(data, drawingType, drawingMode);
}

export function $isCodeDrawingNode(
  node: LexicalNode | null | undefined,
): node is CodeDrawingNode {
  if (!node) return false;
  if (node instanceof CodeDrawingNode) return true;
  return node.getType() === 'code-drawing';
}
