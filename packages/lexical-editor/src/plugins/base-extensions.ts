import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { defineExtension } from 'lexical';
import type { EditorState, LexicalEditor } from 'lexical';
import type { ParsedInitialValue } from '../utils/parse-initial-value';

export type OnChangeCallback = (
  editorState: EditorState,
  editor: LexicalEditor,
) => void;

export interface OnChangeConfig {
  onChangeRef: { current: OnChangeCallback | undefined };
}

/**
 * Replaces `@lexical/react/LexicalOnChangePlugin`. Fires on every editor
 * update and forwards the latest editor state to the (ref-stored) callback so
 * the extension itself can stay referentially stable across renders.
 */
export const OnChangeExtension = defineExtension({
  name: '@leditor/on-change',
  config: {} as OnChangeConfig,
  register(editor, config) {
    return editor.registerUpdateListener(({ editorState }) => {
      config.onChangeRef.current?.(editorState, editor);
    });
  },
});

export interface InitialValueConfig {
  initialValue?: ParsedInitialValue;
}

/**
 * Sets the editor state from a serialized string on first registration. This
 * runs before the implicit `InitialStateExtension` (which only seeds an empty
 * paragraph when the root is empty), so a provided value is preserved.
 *
 * 根据类型区分处理：
 * - type: 'lexical' → 使用 parseEditorState 解析
 * - type: 'markdown' → 使用 $convertFromMarkdownString 转换
 */
export const InitialValueExtension = defineExtension({
  name: '@leditor/initial-value',
  config: {} as InitialValueConfig,
  register(editor, config) {
    const parsed = config.initialValue;
    if (!parsed) return () => {};

    if (parsed.type === 'markdown') {
      // Markdown 类型，通过 $convertFromMarkdownString 转换为 Lexical 节点
      $convertFromMarkdownString(parsed.text, TRANSFORMERS);
    } else {
      // Lexical 类型，直接解析编辑器状态
      const editorState = editor.parseEditorState(parsed.text);
      editor.setEditorState(editorState || {});
    }
    return () => {};
  },
});
