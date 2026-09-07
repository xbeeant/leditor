import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type BaseSelection,
  COMMAND_PRIORITY_EDITOR,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DROP_COMMAND,
  type ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalCommand,
  type LexicalNode,
  OUTDENT_CONTENT_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  type TextFormatType,
  UNDO_COMMAND,
  createCommand,
  defineExtension,
} from 'lexical';
import { insertBlockWithParagraphAfter } from '../commands';
import type { EditorMode } from '../context';
import { $createTemplateFieldNode, $isTemplateFieldNode } from '../nodes';

/** 插入模板字段的可选参数 */
export type TemplateFieldPayload = {
  value?: string;
  required?: boolean;
  placeholder?: string;
  /** 填写控件类型：`text`（输入框）或 `select`（下拉选择） */
  fieldType?: 'text' | 'select';
  /** 下拉选项（`fieldType === 'select'` 时使用） */
  options?: string[];
  /** 是否行内形态（嵌在文本流中） */
  inline?: boolean;
};

/** 在光标处插入一个可填写模板字段 */
export const INSERT_TEMPLATE_FIELD_COMMAND: LexicalCommand<
  TemplateFieldPayload | undefined
> = createCommand('INSERT_TEMPLATE_FIELD_COMMAND');

/** 同步编辑器模式到扩展内部（由 editor.tsx 的 ModeSync 组件分发） */
export const SET_TEMPLATE_MODE_COMMAND: LexicalCommand<EditorMode> =
  createCommand('SET_TEMPLATE_MODE_COMMAND');

/** 生成模板字段唯一 id */
export function generateTemplateFieldId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `f_${rand}`;
}

/** 节点是否处在某个模板字段内部（含字段自身） */
export function $isTemplateFieldChild(node: LexicalNode): boolean {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isTemplateFieldNode(current)) {
      return true;
    }
    if (current.getType() === 'root') {
      break;
    }
    current = current.getParent();
  }
  return false;
}

/**
 * 模板字段扩展：
 * 1. 注册 `INSERT_TEMPLATE_FIELD_COMMAND`，在光标处插入可填写字段。
 * 2. 在 `edit`（填写）模式下做 lock-filter——固定内容不可写：
 *    - 仅当文档包含模板字段时启用（普通文档保持完全自由编辑，不破坏既有用法）；
 *    - 选区只要触及「非模板字段区域」即被拦截写入/删除/粘贴/拖放/格式化。
 */
export const TemplateFieldExtension = defineExtension({
  name: '@leditor/template-field',
  register(editor) {
    let mode: EditorMode = 'edit';

    const handleMode = editor.registerCommand<EditorMode>(
      SET_TEMPLATE_MODE_COMMAND,
      (payload) => {
        mode = payload;
        return false;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    const insert = editor.registerCommand<TemplateFieldPayload | undefined>(
      INSERT_TEMPLATE_FIELD_COMMAND,
      (payload) => {
        // 默认行内形态；仅显式指定 inline:false 时插入为块级
        const inline = payload?.inline ?? true;
        const field = $createTemplateFieldNode(
          generateTemplateFieldId(),
          payload?.value ?? '',
          payload?.required ?? false,
          payload?.placeholder ?? '',
          payload?.fieldType ?? 'text',
          payload?.options ?? [],
          inline,
        );
        if (inline) {
          // 行内字段：在光标文本流中插入（作为当前文本节点之后的值）
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $insertNodes([field]);
            }
          });
        } else {
          // 块级字段：当前块之后插入字段 + 空段落
          insertBlockWithParagraphAfter(editor, () => field);
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * 文档中是否至少存在一个模板字段
     */
    const hasAnyField = (): boolean =>
      editor.getEditorState().read(() => {
        const walk = (nodes: LexicalNode[]): boolean =>
          nodes.some((node) => {
            if ($isTemplateFieldNode(node)) {
              return true;
            }
            if ($isElementNode(node)) {
              return walk(node.getChildren());
            }
            return false;
          });
        return walk($getRoot().getChildren());
      });

    /**
     * 填写（edit）模板模式下是否应锁定固定内容。
     * 该状态由 React 层 ReadOnlySync 同步（edit + 文档含字段 → 整体只读），
     * 这里仅作为兜底：拦截撤销/重做，防止用户在填写模式回退结构变更。
     */
    const $shouldBlockHistory = (): boolean =>
      mode === 'edit' && hasAnyField();

    const unregisterUndo = editor.registerCommand<void>(
      UNDO_COMMAND,
      () => $shouldBlockHistory(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterRedo = editor.registerCommand<void>(
      REDO_COMMAND,
      () => $shouldBlockHistory(),
      COMMAND_PRIORITY_EDITOR,
    );

    /**
     * 判断一次写入命令是否应当被拦截。
     */
    const $shouldBlock = (): boolean => {
      if (mode !== 'edit') {
        return false;
      }
      const selection = $getSelection();
      if (!selection) {
        return false;
      }
      const nodes = selection.getNodes();
      if (nodes.length === 0) {
        return false;
      }
      // 选区完全位于字段内部 → 放行
      if (nodes.every((n) => $isTemplateFieldChild(n))) {
        return false;
      }
      // 命中非字段区域：仅当文档确实含模板字段时才视为固定内容，拦截写入
      return hasAnyField();
    };

    /**
     * 块级字段的「自动行内化」。
     *
     * 当块级字段（inline=false）因为前面内容的删除/回退而并入了文本行——
     * 即它的父元素已经不只有它自己，而是与文本/其它行内内容共存——
     * 就把它自动切换为行内形态（inline=true），避免出现「块级字段孤零零
     * 夹在一段文字中间」的割裂排版。
     *
     * 只在块级字段明显嵌入文本流时触发：父元素存在除该字段以外的文本节点。
     * 转换后 isInline()=true，不会再进入本检测，因此不会无限循环。
     */
    const unregisterAutoInline = editor.registerUpdateListener(
      ({ editorState }) => {
        const toInline: string[] = [];
        editorState.read(() => {
          const walk = (nodes: LexicalNode[]) => {
            for (const node of nodes) {
              if ($isTemplateFieldNode(node) && !node.isInline()) {
                const parent = node.getParent();
                if (
                  $isElementNode(parent) &&
                  parent
                    .getChildren()
                    .some((child) => child !== node && $isTextNode(child))
                ) {
                  toInline.push(node.getKey());
                }
              }
              if ($isElementNode(node)) {
                walk(node.getChildren());
              }
            }
          };
          walk($getRoot().getChildren());
        });
        if (toInline.length > 0) {
          const keys = toInline;
          editor.update(() => {
            for (const key of keys) {
              const node = $getNodeByKey(key);
              if ($isTemplateFieldNode(node) && !node.isInline()) {
                node.setInline(true);
              }
            }
          });
        }
      },
    );

    const unregisterWrite = editor.registerCommand<KeyboardEvent>(
      KEY_BACKSPACE_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterDel = editor.registerCommand<KeyboardEvent>(
      KEY_DELETE_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterEnter = editor.registerCommand<KeyboardEvent | null>(
      KEY_ENTER_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterIme = editor.registerCommand<InputEvent | string>(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterDeleteChar = editor.registerCommand<boolean>(
      DELETE_CHARACTER_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterDeleteWord = editor.registerCommand<boolean>(
      DELETE_WORD_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterDeleteLine = editor.registerCommand<boolean>(
      DELETE_LINE_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterPara = editor.registerCommand<void>(
      INSERT_PARAGRAPH_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterLineBreak = editor.registerCommand<boolean>(
      INSERT_LINE_BREAK_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterFormatText = editor.registerCommand<TextFormatType>(
      FORMAT_TEXT_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterFormatElement = editor.registerCommand<ElementFormatType>(
      FORMAT_ELEMENT_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterIndent = editor.registerCommand<void>(
      INDENT_CONTENT_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterOutdent = editor.registerCommand<void>(
      OUTDENT_CONTENT_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterPaste = editor.registerCommand<
      ClipboardEvent | InputEvent | KeyboardEvent
    >(PASTE_COMMAND, () => $shouldBlock(), COMMAND_PRIORITY_EDITOR);

    const unregisterSelectPaste = editor.registerCommand<{
      nodes: LexicalNode[];
      selection: BaseSelection;
    }>(
      SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    const unregisterCut = editor.registerCommand<
      ClipboardEvent | KeyboardEvent | null
    >(CUT_COMMAND, () => $shouldBlock(), COMMAND_PRIORITY_EDITOR);

    const unregisterDrop = editor.registerCommand<DragEvent>(
      DROP_COMMAND,
      () => $shouldBlock(),
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      handleMode();
      insert();
      unregisterUndo();
      unregisterRedo();
      unregisterAutoInline();
      unregisterWrite();
      unregisterDel();
      unregisterEnter();
      unregisterIme();
      unregisterDeleteChar();
      unregisterDeleteWord();
      unregisterDeleteLine();
      unregisterPara();
      unregisterLineBreak();
      unregisterFormatText();
      unregisterFormatElement();
      unregisterIndent();
      unregisterOutdent();
      unregisterPaste();
      unregisterSelectPaste();
      unregisterCut();
      unregisterDrop();
    };
  },
});
