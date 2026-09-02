import {
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { OutlineComponent } from '../components';

export type SerializedOutlineNode = Spread<
  {
    data: OutlineData;
  },
  SerializedLexicalNode
>;

/** 大纲节点持久化数据 */
export type OutlineData = Record<string, never>;

/** 默认空数据 */
const DEFAULT_DATA: OutlineData = {};

/** 创建大纲节点 */
export function $createOutlineNode(
  data: OutlineData = DEFAULT_DATA,
): OutlineNode {
  return new OutlineNode(data);
}

/** 判断节点是否为 OutlineNode */
export function $isOutlineNode(
  node: LexicalNode | null | undefined,
): node is OutlineNode {
  if (!node) return false;
  if (node instanceof OutlineNode) return true;
  return node.getType() === 'outline';
}

/**
 * 大纲节点：渲染文档中所有标题的嵌套列表（大纲视图）。
 * 数据变更时自动重新渲染。
 */
export class OutlineNode extends DecoratorNode<JSX.Element> {
  __data: OutlineData;

  static override getType(): string {
    return 'outline';
  }

  static override clone(node: OutlineNode): OutlineNode {
    return new OutlineNode(node.__data, node.__key);
  }

  static override importJSON(
    serializedNode: SerializedOutlineNode,
  ): OutlineNode {
    return new OutlineNode(serializedNode.data ?? DEFAULT_DATA);
  }

  override exportJSON(): SerializedOutlineNode {
    return {
      ...super.exportJSON(),
      data: this.__data,
    };
  }

  constructor(data: OutlineData = DEFAULT_DATA, key?: NodeKey) {
    super(key);
    this.__data = data;
  }

  override createDOM(): HTMLElement {
    return document.createElement('span');
  }

  override updateDOM(): false {
    return false;
  }

  setData(data: OutlineData): void {
    const self = this.getWritable();
    self.__data = data;
  }

  getData(): OutlineData {
    return this.getLatest().__data;
  }

  override decorate(
    _editor: LexicalEditor,
    _config: EditorConfig,
  ): JSX.Element {
    return <OutlineComponent nodeKey={this.getKey()} />;
  }

  override isInline(): boolean {
    return false;
  }

  override isKeyboardSelectable(): boolean {
    return true;
  }
}
