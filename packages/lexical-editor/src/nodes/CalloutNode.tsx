import type {
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from 'lexical';
import {
  $createLineBreakNode,
  $createParagraphNode,
  ElementNode,
} from 'lexical';

export type CalloutIcon =
  | 'info'
  | 'warning'
  | 'danger'
  | 'success'
  | 'note';

export type SerializedCalloutNode = Spread<
  {
    icon: string;
  },
  SerializedElementNode
>;

// 不同提示类型的样式映射（Tailwind）
const CALLOUT_STYLES: Record<CalloutIcon, { container: string; badge: string; label: string }> = {
  info: {
    container:
      'border-blue-300 bg-blue-50 text-blue-900',
    badge: 'bg-blue-100 text-blue-700',
    label: '提示',
  },
  warning: {
    container:
      'border-amber-300 bg-amber-50 text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
    label: '警告',
  },
  danger: {
    container:
      'border-red-300 bg-red-50 text-red-900',
    badge: 'bg-red-100 text-red-700',
    label: '危险',
  },
  success: {
    container:
      'border-emerald-300 bg-emerald-50 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
    label: '成功',
  },
  note: {
    container:
      'border-gray-300 bg-gray-50 text-gray-800',
    badge: 'bg-gray-100 text-gray-600',
    label: '备注',
  },
};

/**
 * Callout / 提示块节点：用于插入带类型图标的高亮提示区块
 * （info / warning / danger / success / note）。
 */
export class CalloutNode extends ElementNode {
  __icon: CalloutIcon;

  static override getType(): string {
    return 'callout';
  }

  static override clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__icon, node.__key);
  }

  constructor(icon: CalloutIcon, key?: NodeKey) {
    super(key);
    this.__icon = icon;
  }

  getIcon(): CalloutIcon {
    return this.__icon;
  }

  setIcon(icon: CalloutIcon): void {
    const writable = this.getWritable();
    writable.__icon = icon;
  }

  override createDOM(): HTMLElement {
    const dom = document.createElement('div');
    const style = CALLOUT_STYLES[this.__icon] ?? CALLOUT_STYLES.note;
    dom.className = `lexical-callout relative my-2 rounded-lg border-l-4 px-4 py-3 ${style.container}`;
    dom.setAttribute('data-icon', this.__icon);
    return dom;
  }

  override updateDOM(prevNode: CalloutNode, dom: HTMLElement): boolean {
    if (prevNode.__icon !== this.__icon) {
      const style = CALLOUT_STYLES[this.__icon] ?? CALLOUT_STYLES.note;
      dom.className = `lexical-callout relative my-2 rounded-lg border-l-4 px-4 py-3 ${style.container}`;
      dom.setAttribute('data-icon', this.__icon);
    }
    return false;
  }

  // 在 Callout 内按回车时插入换行（新段落），而非跳出外层
  override insertNewAfter(
    _selection: RangeSelection,
    _restoreSelection = true,
  ): ElementNode | null {
    const lineBreak = $createLineBreakNode();
    _selection.insertNodes([lineBreak]);
    return null;
  }

  // 光标在 Callout 最前面按退格时，将内容转换为普通段落
  override collapseAtStart(): true {
    const paragraph = $createParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => paragraph.append(child));
    this.replace(paragraph);
    return true;
  }

  static override importJSON(
    serializedNode: SerializedCalloutNode,
  ): CalloutNode {
    const node = $createCalloutNode(
      (serializedNode.icon as CalloutIcon) || 'note',
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  override exportJSON(): SerializedCalloutNode {
    return {
      ...super.exportJSON(),
      type: 'callout',
      icon: this.__icon,
      version: 1,
    };
  }
}

export function $createCalloutNode(icon: CalloutIcon = 'note'): CalloutNode {
  return new CalloutNode(icon);
}

export function isCalloutNode(
  node: unknown,
): node is CalloutNode {
  return node instanceof CalloutNode;
}
