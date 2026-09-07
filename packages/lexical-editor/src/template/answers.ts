import type { SerializedEditorState } from 'lexical';

/** 单个模板字段的提取结果 */
export interface TemplateFieldAnswer {
  /** 字段 id（`f_xxx`） */
  id: string;
  /** 用户填写的值 */
  value: string;
  /** 是否必填 */
  required: boolean;
  /** 是否已填写（非空） */
  filled: boolean;
  /** 占位文案 */
  placeholder: string;
  /** 填写控件类型：`text`（输入框）或 `select`（下拉选择） */
  fieldType: 'text' | 'select';
  /** 下拉选项（`fieldType === 'select'` 时使用） */
  options: string[];
  /** 是否行内形态 */
  inline: boolean;
}

/** 答案提取结果：以字段 id 为键的映射 */
export type AnswersMap = Record<string, TemplateFieldAnswer>;

/** 序列化后的模板字段节点形状（与 nodes/template-field-node.tsx 的 SerializedTemplateFieldNode 一致） */
interface SerializedTemplateFieldShape {
  type: 'templateField';
  id: string;
  value: string;
  required: boolean;
  placeholder: string;
  fieldType?: 'text' | 'select';
  options?: string[];
  inline?: boolean;
}

/** 判断序列化节点是否为模板字段 */
export function $isSerializedTemplateField(
  node: unknown,
): node is SerializedTemplateFieldShape {
  return (
    node !== null &&
    typeof node === 'object' &&
    (node as { type?: string }).type === 'templateField'
  );
}

/**
 * 序列化的 EditorState 中是否包含至少一个模板字段。
 * 供 React 层判定「当前文档是否为模板」，从而在 edit（填写）模式下锁定固定内容。
 */
export function hasTemplateFields(
  state: SerializedEditorState | Record<string, unknown>,
): boolean {
  const fields: SerializedTemplateFieldShape[] = [];
  collectTemplateFields((state as { root?: unknown })?.root, fields);
  return fields.length > 0;
}

/** 遍历序列化节点树，取出所有模板字段（递归，兼容任意嵌套深度） */
function collectTemplateFields(
  node: unknown,
  result: SerializedTemplateFieldShape[],
): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectTemplateFields(child, result);
    }
    return;
  }
  if (node === null || typeof node !== 'object') {
    return;
  }
  const obj = node as Record<string, unknown>;
  if ($isSerializedTemplateField(obj)) {
    result.push(obj);
  }
  if (obj.children !== undefined) {
    collectTemplateFields(obj.children, result);
  }
}

/**
 * 从序列化的 EditorState JSON 中提取所有模板字段答案。
 *
 * 结果以字段 id 为键，便于外部把「答案」从模板中分离存储（模板 + 答案分离模型）。
 *
 * @example
 * ```ts
 * const answers = extractAnswers(editorStateJson);
 * // → { 'f_1': { id: 'f_1', value: '示例公司', required: true, filled: true }, ... }
 * ```
 */
export function extractAnswers(
  state: SerializedEditorState | Record<string, unknown>,
): AnswersMap {
  const fields: SerializedTemplateFieldShape[] = [];
  collectTemplateFields((state as { root?: unknown })?.root, fields);

  const result: AnswersMap = {};
  for (const field of fields) {
    result[field.id] = {
      id: field.id,
      value: field.value ?? '',
      required: field.required ?? false,
      filled: (field.value ?? '') !== '',
      placeholder: field.placeholder ?? '',
      fieldType: field.fieldType ?? 'text',
      options: field.options ?? [],
      inline: field.inline ?? false,
    };
  }
  return result;
}

/** 查找是否有未填写的必填字段 */
export function findMissingFields(
  state: SerializedEditorState | Record<string, unknown>,
): TemplateFieldAnswer[] {
  const answers = extractAnswers(state);
  return Object.values(answers).filter((a) => a.required && !a.filled);
}

/**
 * 完整性校验：返回所有未填必填字段的 id 列表，以及整体是否完整。
 */
export function checkCompleteness(
  state: SerializedEditorState | Record<string, unknown>,
): { missing: string[]; complete: boolean } {
  const missing = findMissingFields(state).map((a) => a.id);
  return { missing, complete: missing.length === 0 };
}
