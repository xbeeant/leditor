import {
  $createListItemNode,
  $isListItemNode,
  $isListNode,
  ListNode,
  type ListType,
  type SerializedListNode,
} from '@lexical/list';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isLeafNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type EditorConfig,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
} from 'lexical';

/**
 * 扩展的列表类型。除默认的 number / bullet / check 外，
 * 还支持小写字母、大写字母、小写罗马数字、大写罗马数字。
 */
export type ExtendedListType =
  | 'number'
  | 'bullet'
  | 'check'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman';

/** 扩展列表类型对应的 CSS list-style-type 值（number/bullet/check 由 theme 控制） */
const LIST_STYLE_TYPE_MAP: Partial<Record<ExtendedListType, string>> = {
  'lower-alpha': 'lower-alpha',
  'upper-alpha': 'upper-alpha',
  'lower-roman': 'lower-roman',
  'upper-roman': 'upper-roman',
};

/** 需要渲染为 <ol> 的列表类型 */
const ORDERED_LIST_TYPES: ReadonlySet<string> = new Set([
  'number',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
]);

/** ListStyleNode 的序列化结构 */
export type SerializedListStyleNode = Omit<
  SerializedListNode,
  'type' | 'listType'
> & {
  type: 'list-style';
  listType: ExtendedListType;
};

/**
 * 将 list-style-type 应用到 DOM 元素。
 * 同时处理 ExtendedListType 映射和通过 setStyle() 设置的内联样式。
 */
function applyBulletStyle(
  dom: HTMLElement,
  listType: string,
  inlineStyle: string,
): void {
  const style = LIST_STYLE_TYPE_MAP[listType as ExtendedListType];
  if (style) {
    dom.style.listStyleType = style;
  } else {
    dom.style.removeProperty('list-style-type');
  }
  // 应用通过 setStyle() 设置的内联样式（如 list-style-type:circle）
  if (inlineStyle) {
    const props = inlineStyle.split(';').filter(Boolean);
    for (const prop of props) {
      const [key, value] = prop.split(':').map((s) => s.trim());
      if (key && value) {
        dom.style.setProperty(key, value);
      }
    }
  }
}

/**
 * 自定义 ListNode 子类：
 * - 使用独立的节点类型 'list-style'（Lexical 0.49 不允许子类与基类共用 type）
 * - 支持扩展的 listType（字母 / 罗马数字等）
 * - 扩展的有序列表类型渲染为 <ol>，并设置对应的 list-style-type
 */
export class ListStyleNode extends ListNode {
  static getType(): string {
    return 'list-style';
  }

  static clone(node: ListStyleNode): ListStyleNode {
    return new ListStyleNode(
      node.getListType() as ExtendedListType,
      node.getStart(),
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedListStyleNode): ListStyleNode {
    const node = $createListStyleNode(
      serializedNode.listType,
      serializedNode.start,
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportJSON(): any {
    return {
      ...super.exportJSON(),
      type: 'list-style',
      listType: this.getListType() as ExtendedListType,
    };
  }

  constructor(listType: ExtendedListType = 'number', start = 1, key?: string) {
    super(listType as ListType, start, key);
    // 基类仅将 'number' 渲染为 <ol>，这里将扩展的有序类型也修正为 <ol>
    if (ORDERED_LIST_TYPES.has(this.__listType)) {
      this.__tag = 'ol';
    }
  }

  setListType(type: ExtendedListType): this {
    const writable = this.getWritable();
    writable.__listType = type as ListType;
    writable.__tag = ORDERED_LIST_TYPES.has(type) ? 'ol' : 'ul';
    return writable;
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const dom = super.createDOM(config, editor);
    applyBulletStyle(dom, this.__listType, this.getStyle());
    return dom;
  }

  updateDOM(
    prevNode: ListStyleNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    const replaced = ListNode.prototype.updateDOM.call(
      this,
      prevNode,
      dom,
      config,
    );
    if (!replaced) {
      applyBulletStyle(dom, this.__listType, this.getStyle());
    }
    return replaced;
  }
}

/**
 * 创建 ListStyleNode。ListStyleNode 使用独立类型 'list-style'，
 * 不与 ListNode（type 'list'）冲突，因此可以直接实例化。
 */
export function $createListStyleNode(
  listType: ExtendedListType = 'number',
  start = 1,
): ListStyleNode {
  return $applyNodeReplacement(new ListStyleNode(listType, start));
}

/** 判断节点是否为 ListStyleNode */
export function $isListStyleNode(
  node: LexicalNode | null | undefined,
): node is ListStyleNode {
  return node instanceof ListStyleNode;
}

function append(node: ElementNode, nodesToAppend: LexicalNode[]): void {
  node.splice(node.getChildrenSize(), 0, nodesToAppend);
}

function $isSelectingEmptyListItem(
  anchorNode: LexicalNode,
  nodes: LexicalNode[],
): boolean {
  return (
    $isListItemNode(anchorNode) &&
    (nodes.length === 0 ||
      (nodes.length === 1 &&
        anchorNode.is(nodes[0]) &&
        anchorNode.getChildrenSize() === 0))
  );
}

/**
 * 参照 @lexical/list 的 $insertList，将选区所在块切换为指定格式的扩展列表
 * （使用 ListStyleNode 以支持字母 / 罗马数字等格式）。
 * @param listType - 列表格式：number | lower-alpha | upper-alpha | lower-roman | upper-roman
 */
export function $insertListStyle(listType: ExtendedListType): void {
  const selection = $getSelection();

  if (selection !== null) {
    let nodes = selection.getNodes();
    if ($isRangeSelection(selection)) {
      const [anchor] = selection.getStartEndPoints();
      const anchorNode = anchor.getNode();
      const anchorNodeParent = anchorNode.getParent();

      if ($isRootOrShadowRoot(anchorNode)) {
        const firstChild = anchorNode.getFirstChild();
        if (firstChild) {
          nodes = firstChild.selectStart().getNodes();
        } else {
          const paragraph = $createParagraphNode();
          anchorNode.append(paragraph);
          nodes = paragraph.select().getNodes();
        }
      } else if ($isSelectingEmptyListItem(anchorNode, nodes)) {
        const list = $createListStyleNode(listType);

        if ($isRootOrShadowRoot(anchorNodeParent)) {
          anchorNode.replace(list);
          const listItem = $createListItemNode();
          if ($isElementNode(anchorNode)) {
            listItem.setFormat(anchorNode.getFormatType());
            listItem.setIndent(anchorNode.getIndent());
          }
          list.append(listItem);
        } else if ($isListItemNode(anchorNode)) {
          const parent = anchorNode.getParentOrThrow();
          append(list, parent.getChildren());
          parent.replace(list);
        }

        return;
      }
    }

    const handled = new Set<NodeKey>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (
        $isElementNode(node) &&
        node.isEmpty() &&
        !$isListItemNode(node) &&
        !handled.has(node.getKey())
      ) {
        $createListOrMergeStyle(node, listType);
        continue;
      }

      let parent = $isLeafNode(node)
        ? node.getParent()
        : $isListItemNode(node) && node.isEmpty()
          ? node
          : null;

      while (parent != null) {
        const parentKey = parent.getKey();

        if ($isListNode(parent)) {
          if (!handled.has(parentKey)) {
            const newListNode = $createListStyleNode(listType);
            append(newListNode, parent.getChildren());
            parent.replace(newListNode);
            handled.add(parentKey);
          }

          break;
        }
        const nextParent = parent.getParent();

        if ($isRootOrShadowRoot(nextParent) && !handled.has(parentKey)) {
          handled.add(parentKey);
          $createListOrMergeStyle(parent, listType);
          break;
        }

        parent = nextParent;
      }
    }
  }
}

function $createListOrMergeStyle(
  node: ElementNode,
  listType: ExtendedListType,
): ListNode {
  if ($isListNode(node)) {
    return node;
  }

  const previousSibling = node.getPreviousSibling();
  const nextSibling = node.getNextSibling();
  const listItem = $createListItemNode();
  append(listItem, node.getChildren());

  let targetList: ListNode;
  if (
    $isListNode(previousSibling) &&
    listType === previousSibling.getListType()
  ) {
    previousSibling.append(listItem);
    // if the same type of list is on both sides, merge them.
    if ($isListNode(nextSibling) && listType === nextSibling.getListType()) {
      append(previousSibling, nextSibling.getChildren());
      nextSibling.remove();
    }
    targetList = previousSibling;
  } else if (
    $isListNode(nextSibling) &&
    listType === nextSibling.getListType()
  ) {
    nextSibling.getFirstChildOrThrow().insertBefore(listItem);
    targetList = nextSibling;
  } else {
    const list = $createListStyleNode(listType);
    list.append(listItem);
    node.replace(list);
    targetList = list;
  }
  // listItem needs to be attached to root prior to setting indent
  listItem.setFormat(node.getFormatType());
  listItem.setIndent(node.getIndent());

  // Preserve element-anchored selections by updating them to anchor to the listItem instead of the listNode.
  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    if (targetList.getKey() === selection.anchor.key) {
      selection.anchor.set(
        listItem.getKey(),
        selection.anchor.offset,
        'element',
      );
    }
    if (targetList.getKey() === selection.focus.key) {
      selection.focus.set(listItem.getKey(), selection.focus.offset, 'element');
    }
  }

  node.remove();

  return targetList;
}
