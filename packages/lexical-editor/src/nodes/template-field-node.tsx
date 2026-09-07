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
import { TemplateFieldComponent } from '../components';

/** 模板字段的填写控件类型 */
export type TemplateFieldType = 'text' | 'select';

export type SerializedTemplateFieldNode = Spread<
  {
    /** 字段唯一标识（模板内稳定，用于跨模板/答案提取） */
    id: string;
    /** 是否必填 */
    required: boolean;
    /** 填写提示文案，输入为空时展示为占位 */
    placeholder: string;
    /** 字段当前值（设计模式下为「默认值/示例」，编辑模式下为用户填写的答案） */
    value: string;
    /** 填写控件类型：`text`（输入框）或 `select`（下拉选择）。
     *  注：序列化中命名为 `fieldType`，因为 `type` 是 Lexical 节点类型保留字段。 */
    fieldType?: TemplateFieldType;
    /** 下拉选项（`fieldType === 'select'` 时使用） */
    options?: string[];
    /** 是否为行内形态（嵌在文本流中）；`false` 时作为独立块级字段 */
    inline?: boolean;
    /** 设计模式下输入的属性（占位/必填）仅在设计态保存 */
    design?: boolean;
    version: number;
  },
  SerializedLexicalNode
>;

/**
 * 模板可填写字段节点。
 *
 * 设计者通过该节点圈定「允许用户填写」的区域：
 * - 设计模式（design）：可编辑字段值（作为默认值/示例），并可配置占位文案、必填标记、
 *   字段类型（输入框 / 下拉）、下拉选项与行内形态。
 * - 编辑模式（edit / 填写）：固定内容锁定，仅此类字段可被填写。
 * - 只读模式（readonly）：与固定内容一起不可编辑。
 */
export class TemplateFieldNode extends DecoratorNode<JSX.Element> {
  __id: string;
  __required: boolean;
  __placeholder: string;
  __value: string;
  /** 填写控件类型（`text` / `select`）。注意不能命名为 `__type`，那是 Lexical 基类保留字段（节点类型）。 */
  __fieldType: TemplateFieldType;
  __options: string[];
  __inline: boolean;

  static getType(): string {
    return 'templateField';
  }

  static clone(node: TemplateFieldNode): TemplateFieldNode {
    return new TemplateFieldNode(
      node.__id,
      node.__value,
      node.__required,
      node.__placeholder,
      node.__fieldType,
      node.__options,
      node.__inline,
      node.__key,
    );
  }

  constructor(
    id: string,
    value = '',
    required = false,
    placeholder = '',
    type: TemplateFieldType = 'text',
    options: string[] = [],
    inline = true,
    key?: NodeKey,
  ) {
    super(key);
    this.__id = id;
    this.__value = value;
    this.__required = required;
    this.__placeholder = placeholder;
    this.__fieldType = type;
    this.__options = options;
    this.__inline = inline;
  }

  static importJSON(
    serializedNode: SerializedTemplateFieldNode,
  ): TemplateFieldNode {
    const node = $createTemplateFieldNode(
      serializedNode.id,
      serializedNode.value ?? '',
      serializedNode.required ?? false,
      serializedNode.placeholder ?? '',
      serializedNode.fieldType ?? 'text',
      serializedNode.options ?? [],
      serializedNode.inline ?? true,
    );
    return node;
  }

  exportJSON(): SerializedTemplateFieldNode {
    return {
      type: 'templateField',
      id: this.getId(),
      value: this.getValue(),
      required: this.isRequired(),
      placeholder: this.getPlaceholder(),
      fieldType: this.getFieldType(),
      options: this.getOptions(),
      inline: this.isInline(),
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    element.className = 'leditor-template-field';
    element.setAttribute('data-leditor-inline', String(this.__inline));
    return element;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('data-leditor-template-field', this.getId());
    element.textContent = this.getValue();
    return { element };
  }

  updateDOM(_prevNode: unknown, dom: HTMLElement): boolean {
    const prevInline = dom.getAttribute('data-leditor-inline') === 'true';
    return prevInline !== this.__inline;
  }

  isInline(): boolean {
    return this.__inline;
  }

  getTextContent(): string {
    return this.getValue();
  }

  getId(): string {
    return this.__id;
  }

  getValue(): string {
    return this.__value;
  }

  isRequired(): boolean {
    return this.__required;
  }

  getPlaceholder(): string {
    return this.__placeholder;
  }

  getOptions(): string[] {
    return this.__options;
  }

  getFieldType(): TemplateFieldType {
    return this.__fieldType;
  }

  setId(id: string): void {
    const writable = this.getWritable();
    writable.__id = id;
  }

  setValue(value: string): void {
    const writable = this.getWritable();
    writable.__value = value;
  }

  setRequired(required: boolean): void {
    const writable = this.getWritable();
    writable.__required = required;
  }

  setPlaceholder(placeholder: string): void {
    const writable = this.getWritable();
    writable.__placeholder = placeholder;
  }

  setType(type: TemplateFieldType): void {
    const writable = this.getWritable();
    writable.__fieldType = type;
  }

  setOptions(options: string[]): void {
    const writable = this.getWritable();
    writable.__options = options;
  }

  setInline(inline: boolean): void {
    const writable = this.getWritable();
    writable.__inline = inline;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <TemplateFieldComponent
        value={this.__value}
        required={this.__required}
        placeholder={this.__placeholder}
        fieldType={this.__fieldType}
        options={this.__options}
        inline={this.__inline}
        nodeKey={this.__key}
      />
    );
  }
}

export function $createTemplateFieldNode(
  id: string,
  value = '',
  required = false,
  placeholder = '',
  type: TemplateFieldType = 'text',
  options: string[] = [],
  inline = true,
): TemplateFieldNode {
  return new TemplateFieldNode(
    id,
    value,
    required,
    placeholder,
    type,
    options,
    inline,
  );
}

export function $isTemplateFieldNode(
  node: LexicalNode | null | undefined,
): node is TemplateFieldNode {
  return node instanceof TemplateFieldNode;
}
