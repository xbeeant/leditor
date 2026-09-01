import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $insertNodeToNearestRoot } from '@lexical/utils';
import {
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
} from 'lexical';
import type { EditorState, LexicalEditor } from 'lexical';
import { $createEquationNode, EquationNode } from './nodes/EquationNode';
import { $createImageNode, ImageNode } from './nodes/ImageNode';
import {
  INSERT_AUDIO_COMMAND,
  INSERT_EQUATION_COMMAND,
  INSERT_FILE_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_VIDEO_COMMAND,
  type InsertAudioPayload,
  type InsertEquationPayload,
  type InsertFilePayload,
  type InsertImagePayload,
  type InsertVideoPayload,
  insertBlockWithParagraphAfter,
} from './commands';
import { $createAudioNode, AudioNode } from './nodes/AudioNode';
import { $createFileNode, FileNode } from './nodes/FileNode';
import { $createVideoNode, VideoNode } from './nodes/VideoNode';

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
  initialValue?: string;
}

/**
 * Sets the editor state from a serialized string on first registration. This
 * runs before the implicit `InitialStateExtension` (which only seeds an empty
 * paragraph when the root is empty), so a provided value is preserved.
 */
export const InitialValueExtension = defineExtension({
  name: '@leditor/initial-value',
  config: {} as InitialValueConfig,
  register(editor, config) {
    if (config.initialValue) {
      editor.setEditorState(editor.parseEditorState(config.initialValue));
    }
    return () => {};
  },
});

/**
 * Replaces the inline `InsertImagePlugin`. Registers the
 * `INSERT_IMAGE_COMMAND` so images can be inserted from anywhere with editor
 * access.
 */
export const InsertImageExtension = defineExtension({
  name: '@leditor/insert-image',
  register(editor) {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('InsertImageExtension: ImageNode not registered');
    }
    return editor.registerCommand<InsertImagePayload>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});

/**
 * Replaces `@lexical/react/LexicalHorizontalRulePlugin`. Uses the React
 * `HorizontalRuleNode` (so it renders with selection UI) while keeping the
 * editor configuration fully extension-based.
 */
export const HorizontalRuleExtension = defineExtension({
  name: '@leditor/horizontal-rule',
  register(editor) {
    return editor.registerCommand(
      INSERT_HORIZONTAL_RULE_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return false;
        const focusNode = selection.focus.getNode();
        if (focusNode !== null) {
          $insertNodeToNearestRoot($createHorizontalRuleNode());
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});

/**
 * Registers the `INSERT_EQUATION_COMMAND` so equations can be inserted
 * from anywhere with editor access.
 */
export const InsertEquationExtension = defineExtension({
  name: '@leditor/insert-equation',
  register(editor) {
    if (!editor.hasNodes([EquationNode])) {
      throw new Error('InsertEquationExtension: EquationNode not registered');
    }
    return editor.registerCommand<InsertEquationPayload>(
      INSERT_EQUATION_COMMAND,
      (payload) => {
        if (payload.inline) {
          $insertNodes([$createEquationNode(payload.equation, true)]);
          return true;
        }
        // 块级公式：插入后追加一个正文段落，光标落入新段落以便继续输入
        insertBlockWithParagraphAfter(editor, () =>
          $createEquationNode(payload.equation, false),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});

/**
 * 注册 `INSERT_VIDEO_COMMAND`,在光标后插入视频节点并追加正文段落,
 * 使光标能继续输入。视频为块级、无自带光标。
 */
export const InsertVideoExtension = defineExtension({
  name: '@leditor/insert-video',
  register(editor) {
    if (!editor.hasNodes([VideoNode])) {
      throw new Error('InsertVideoExtension: VideoNode not registered');
    }
    return editor.registerCommand<InsertVideoPayload>(
      INSERT_VIDEO_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createVideoNode({
            src: payload.src,
            width: payload.width,
            height: payload.height,
          }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});

/**
 * 注册 `INSERT_AUDIO_COMMAND`,在光标后插入音频节点并追加正文段落。
 */
export const InsertAudioExtension = defineExtension({
  name: '@leditor/insert-audio',
  register(editor) {
    if (!editor.hasNodes([AudioNode])) {
      throw new Error('InsertAudioExtension: AudioNode not registered');
    }
    return editor.registerCommand<InsertAudioPayload>(
      INSERT_AUDIO_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createAudioNode({ src: payload.src }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});

/**
 * 注册 `INSERT_FILE_COMMAND`,在光标后插入文件节点（附件），并追加正文段落。
 * 文件节点以内联附件卡片形式渲染，支持下载和删除操作。
 */
export const InsertFileExtension = defineExtension({
  name: '@leditor/insert-file',
  register(editor) {
    if (!editor.hasNodes([FileNode])) {
      throw new Error('InsertFileExtension: FileNode not registered');
    }
    return editor.registerCommand<InsertFilePayload>(
      INSERT_FILE_COMMAND,
      (payload) => {
        insertBlockWithParagraphAfter(editor, () =>
          $createFileNode({
            url: payload.url,
            filename: payload.filename,
            size: payload.size,
          }),
        );
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  },
});
