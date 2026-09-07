import {
  type DOMConversionMap,
  type DOMConversionOutput,
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
import { Suspense, lazy } from 'react';
import type { MindElements } from '../modals';

const MindComponent = lazy(() => import('../components/mind-component'));

export type SerializedMindNode = Spread<
  {
    data: MindElements;
    width?: number | 'inherit';
    height?: number | 'inherit';
  },
  SerializedLexicalNode
>;

type Dimension = number | 'inherit';

function $convertMindElement(domNode: HTMLElement): DOMConversionOutput | null {
  const raw = domNode.getAttribute('data-lexical-mind-json');
  if (!raw) return null;
  let data: MindElements;
  try {
    data = JSON.parse(raw) as MindElements;
  } catch {
    return null;
  }
  const style = window.getComputedStyle(domNode);
  const parseDim = (val: string): Dimension => {
    if (!val || val === 'inherit') return 'inherit';
    const n = Number.parseInt(val, 10);
    return Number.isNaN(n) ? 'inherit' : n;
  };
  return {
    node: $createMindNode(
      data,
      parseDim(style.getPropertyValue('width')),
      parseDim(style.getPropertyValue('height')),
    ),
  };
}

/**
 * 思维导图节点：以 <img> 形式渲染已保存的 PNG data URL，
 * 双击 / 选中后可重新打开 MindModal 编辑。
 */
export class MindNode extends DecoratorNode<JSX.Element> {
  __data: MindElements;
  __width: Dimension;
  __height: Dimension;

  static override getType(): string {
    return 'mind';
  }

  static override clone(node: MindNode): MindNode {
    return new MindNode(node.__data, node.__width, node.__height, node.__key);
  }

  static override importJSON(serializedNode: SerializedMindNode): MindNode {
    const node = new MindNode(
      serializedNode.data,
      serializedNode.width ?? 'inherit',
      serializedNode.height ?? 'inherit',
    );
    return node.updateFromJSON(serializedNode);
  }

  override exportJSON(): SerializedMindNode {
    return {
      ...super.exportJSON(),
      data: this.__data,
      width: this.__width === 'inherit' ? undefined : this.__width,
      height: this.__height === 'inherit' ? undefined : this.__height,
    };
  }

  constructor(
    data: MindElements = { json: {}, png: '' },
    width: Dimension = 'inherit',
    height: Dimension = 'inherit',
    key?: NodeKey,
  ) {
    super(key);
    this.__data = data;
    this.__width = width;
    this.__height = height;
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const className = config.theme.image;
    if (className !== undefined) span.className = className;
    return span;
  }

  override updateDOM(): false {
    return false;
  }

  static override importDOM(): DOMConversionMap<HTMLSpanElement> | null {
    return {
      span: (domNode: HTMLSpanElement) => {
        if (!domNode.hasAttribute('data-lexical-mind-json')) return null;
        return { conversion: $convertMindElement, priority: 1 };
      },
    };
  }

  override exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('span');
    element.style.display = 'inline-block';
    const content = editor.getElementByKey(this.getKey());
    if (content !== null) {
      const img = content.querySelector('img');
      if (img !== null) element.appendChild(img.cloneNode(true));
    }
    element.style.width =
      this.__width === 'inherit' ? 'inherit' : `${this.__width}px`;
    element.style.height =
      this.__height === 'inherit' ? 'inherit' : `${this.__height}px`;
    element.setAttribute('data-lexical-mind-json', JSON.stringify(this.__data));
    return { element };
  }

  setData(data: MindElements): void {
    const self = this.getWritable();
    self.__data = data;
  }

  setWidth(width: Dimension): void {
    const self = this.getWritable();
    self.__width = width;
  }

  setHeight(height: Dimension): void {
    const self = this.getWritable();
    self.__height = height;
  }

  override decorate(
    _editor: LexicalEditor,
    _config: EditorConfig,
  ): JSX.Element {
    return (
      <Suspense fallback={null}>
        <MindComponent
          nodeKey={this.getKey()}
          data={this.__data}
          width={this.__width}
          height={this.__height}
        />
      </Suspense>
    );
  }

  override isInline(): boolean {
    return false;
  }

  override isKeyboardSelectable(): boolean {
    return true;
  }
}

export function $createMindNode(
  data: MindElements = { json: {}, png: '' },
  width: Dimension = 'inherit',
  height: Dimension = 'inherit',
): MindNode {
  return new MindNode(data, width, height);
}

export function $isMindNode(
  node: LexicalNode | null | undefined,
): node is MindNode {
  if (!node) return false;
  if (node instanceof MindNode) return true;
  return node.getType() === 'mind';
}
