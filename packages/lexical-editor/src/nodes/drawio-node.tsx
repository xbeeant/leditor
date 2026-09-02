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
import type { DrawioElement } from '../modals';

const DrawioComponent = lazy(() => import('../components/drawio-component'));

export type SerializedDrawioNode = Spread<
  {
    data: DrawioElement;
    width?: number | 'inherit';
    height?: number | 'inherit';
  },
  SerializedLexicalNode
>;

type Dimension = number | 'inherit';

function $convertDrawioElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const raw = domNode.getAttribute('data-lexical-drawio-json');
  if (!raw) return null;
  let data: DrawioElement;
  try {
    data = JSON.parse(raw) as DrawioElement;
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
    node: $createDrawioNode(
      data,
      parseDim(style.getPropertyValue('width')),
      parseDim(style.getPropertyValue('height')),
    ),
  };
}

/**
 * Draw.io 图表节点：以 <img> 形式渲染已保存的 SVG data URL，
 * 双击 / 选中后可重新打开 DrawioModal 编辑。编辑结果由 DrawioComponent 处理。
 */
export class DrawioNode extends DecoratorNode<JSX.Element> {
  __data: DrawioElement;
  __width: Dimension;
  __height: Dimension;

  static override getType(): string {
    return 'drawio';
  }

  static override clone(node: DrawioNode): DrawioNode {
    return new DrawioNode(node.__data, node.__width, node.__height, node.__key);
  }

  static override importJSON(serializedNode: SerializedDrawioNode): DrawioNode {
    const node = new DrawioNode(
      serializedNode.data,
      serializedNode.width ?? 'inherit',
      serializedNode.height ?? 'inherit',
    );
    return node.updateFromJSON(serializedNode);
  }

  override exportJSON(): SerializedDrawioNode {
    return {
      ...super.exportJSON(),
      data: this.__data,
      width: this.__width === 'inherit' ? undefined : this.__width,
      height: this.__height === 'inherit' ? undefined : this.__height,
    };
  }

  constructor(
    data: DrawioElement = { src: '', xml: '' },
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
        if (!domNode.hasAttribute('data-lexical-drawio-json')) return null;
        return { conversion: $convertDrawioElement, priority: 1 };
      },
    };
  }

  override exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('span');
    element.style.display = 'inline-block';
    // 优先内联已渲染的 SVG，便于离线导出 / 复制
    const content = editor.getElementByKey(this.getKey());
    if (content !== null) {
      const svg = content.querySelector('svg');
      if (svg !== null) element.innerHTML = svg.outerHTML;
    }
    element.style.width =
      this.__width === 'inherit' ? 'inherit' : `${this.__width}px`;
    element.style.height =
      this.__height === 'inherit' ? 'inherit' : `${this.__height}px`;
    element.setAttribute(
      'data-lexical-drawio-json',
      JSON.stringify(this.__data),
    );
    return { element };
  }

  setData(data: DrawioElement): void {
    const self = this.getWritable();
    self.__data = data;
  }

  getData(): DrawioElement {
    return this.getLatest().__data;
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
        <DrawioComponent
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

export function $createDrawioNode(
  data: DrawioElement = { src: '', xml: '' },
  width: Dimension = 'inherit',
  height: Dimension = 'inherit',
): DrawioNode {
  return new DrawioNode(data, width, height);
}

export function $isDrawioNode(
  node: LexicalNode | null | undefined,
): node is DrawioNode {
  if (!node) return false;
  if (node instanceof DrawioNode) return true;
  return node.getType() === 'drawio';
}
