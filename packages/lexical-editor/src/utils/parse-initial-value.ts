import type { SerializedEditorState } from 'lexical';
import { plateToLexical } from './plate-to-lexical';

/**
 * 编辑器初始值解析结果。
 */
export type ParsedInitialValue =
  | { text: string; type: 'lexical' }
  | { text: string; type: 'markdown' };

/**
 * 编辑器初始值解析器。
 * 将多种格式的初始值统一解析为带类型标记的结果（Lexical JSON 或 Markdown）：
 * - Lexical JSON 字符串 → type: 'lexical'
 * - Lexical JSON 对象 → type: 'lexical'
 * - Plate 数组（字符串或数组）→ 转换为 Lexical 格式，type: 'lexical'
 * - Markdown 字符串（JSON 解析失败）→ type: 'markdown'
 *
 * @example
 * ```ts
 * // Lexical JSON 对象
 * parseInitialValue({ root: { children: [...] } })
 * // → { text: '{"root":{"children":[...]}}', type: 'lexical' }
 *
 * // Plate 数组
 * parseInitialValue([{ type: 'paragraph', children: [...] }])
 * // → { text: '{"root":{"children":[{type:"paragraph",...}]}}', type: 'lexical' }
 *
 * // Markdown
 * parseInitialValue('# Hello')
 * // → { text: '# Hello', type: 'markdown' }
 * ```
 */
export function parseInitialValue(
  value?: SerializedEditorState | string | Record<string, unknown> | unknown[],
): ParsedInitialValue | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        // 字符串化的 Plate 数组，转换为 Lexical 格式
        return {
          text: JSON.stringify(plateToLexical(parsed)),
          type: 'lexical',
        };
      }
      // Lexical JSON 字符串
      return { text: JSON.stringify(parsed), type: 'lexical' };
    } catch {
      // JSON 解析失败，视为 Markdown 字符串
    }
    return { text: value, type: 'markdown' };
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      // Plate 数组，转换为 Lexical 格式
      return {
        text: JSON.stringify(plateToLexical(value as Record<string, any>[])),
        type: 'lexical',
      };
    }
    // 其他对象，直接序列化
    return { text: JSON.stringify(value), type: 'lexical' };
  }
  return undefined;
}
