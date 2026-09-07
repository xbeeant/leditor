import { ClipboardDOMImportExtension } from '@lexical/clipboard';
import { CodeExtension } from '@lexical/code-core';
import {
  AutoFocusExtension,
  TabIndentationExtension,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { AutoLinkExtension } from '@lexical/link';
import { CheckListExtension, ListExtension } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { RichTextExtension } from '@lexical/rich-text';
import { TableExtension } from '@lexical/table';
import type { LexicalEditor, SerializedEditorState } from 'lexical';
import { configExtension, defineExtension } from 'lexical';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  INSERT_AUDIO_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_VIDEO_COMMAND,
  type InsertAudioPayload,
  type InsertImagePayload,
  type InsertVideoPayload,
} from './commands';
import { EditorConfigProvider, LocaleContext } from './context';
import type { EmbedConfig } from './embed';
import type { Locale } from './i18n';
import type { MediaConfig } from './media';
import { AudioNode } from './nodes';
import { CalloutNode } from './nodes';
import { CodeDrawingNode } from './nodes';
import { DrawioNode } from './nodes';
import { EquationNode } from './nodes';
import { FileNode } from './nodes';
import { ImageNode } from './nodes';
import { ListStyleNode } from './nodes';
import { MermaidNode } from './nodes';
import { MindNode } from './nodes';
import { RubyNode } from './nodes';
import { VideoNode } from './nodes';
import {
  EXCLUDE_PARENTS,
  HorizontalRuleExtension,
  InitialValueExtension,
  InsertAudioExtension,
  InsertEquationExtension,
  InsertFileExtension,
  InsertImageExtension,
  InsertVideoExtension,
  MATCHERS,
  type OnChangeCallback,
  OnChangeExtension,
} from './plugins';
import { CalloutExtension } from './plugins';
import { CodeBlockExtension } from './plugins';
import { CodeDrawingExtension } from './plugins';
import { CodeHighlightExtension } from './plugins';
import { CodePasteExtension } from './plugins';
import { DrawioExtension } from './plugins';
import { ExcelTablePasteExtension } from './plugins';
import { MermaidExtension } from './plugins';
import { MindExtension } from './plugins';
import { PasteMediaExtension } from './plugins';
import { TableActionMenuExtension } from './plugins';
import { TableCellResizerExtension } from './plugins';
import { TableDragSelectFixExtension } from './plugins';
import { TableInsertExtension } from './plugins';
import { TableScrollShadowExtension } from './plugins';
import { UniversalBlockEscapeExtension } from './plugins';
import { UploadImagesExtension } from './plugins';
import { MarkdownShortcutExtension } from './plugins/markdown-shortcut-extension';
import { editorTheme } from './theme';

import './checklist.css';
import './table-scroll-shadow.css';
import type { EditorMode } from './context';
import { TemplateFieldNode } from './nodes';
import {
  SET_TEMPLATE_MODE_COMMAND,
  TemplateFieldExtension,
} from './plugins/template-field-extension';
import { hasTemplateFields, TemplateFieldsWatcher } from './template';
import { LightToolbar } from './toolbar/light-toolbar';
import { parseInitialValue } from './utils/parse-initial-value';
import type { ParsedInitialValue } from './utils/parse-initial-value';

/** LightEditor 的 Props 接口 */
export interface LightEditorProps {
  /**
   * 编辑器初始值，支持多种格式：
   * - Lexical JSON 字符串：'{"root":{"children":[...]}}'
   * - Lexical JSON 对象：{root: {children: [...]}}
   * - Markdown 字符串：'# 标题'
   * - Plate 数组格式：[{type: 'paragraph', children: [...]}]
   */
  initialValue?: SerializedEditorState | string | Record<string, unknown>;
  /** 编辑器值变更回调，接收序列化的 EditorState */
  onChange?: (value: SerializedEditorState) => void;
  /** 统一的图片/视频/音频上传下载配置。未配置上传 URL 时禁用文件上传。 */
  media?: MediaConfig;
  /** 外部 iframe 嵌入服务配置（Draw.io / 思维导图）。未配置 drawio 时使用公共嵌入服务；思维导图需显式配置。 */
  embed?: EmbedConfig;
  /** 编辑器占位文本 */
  placeholder?: string;
  /** 初始 locale，默认为 'zh-CN'。 */
  locale?: Locale;
  /** 编辑器是否只读 */
  readOnly?: boolean;
  /**
   * 编辑器模式：`edit`（编辑/填写，默认）、`readonly`（只读）、`design`（模板设计）。
   * 同 `Editor` 的 `mode`。
   */
  mode?: EditorMode;
}

/** LightEditor Ref 类型，用于暴露 LexicalEditor 实例 */
export interface LightEditorRef {
  editor: LexicalEditor;
}

/**
 * 将 React 层的 readOnly 状态同步到 Lexical 编辑器的 editable 状态。
 * 必须位于 LexicalExtensionComposer 内部才能拿到 editor 实例。
 */
function ReadOnlySync({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);
  return null;
}

/**
 * 将 React 层的 mode 同步到模板字段扩展，使 lock-filter 在 edit（填写）模式生效。
 */
function ModeSync({ mode }: { mode: EditorMode }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.dispatchCommand(SET_TEMPLATE_MODE_COMMAND, mode);
  }, [editor, mode]);
  return null;
}

/** 解析后的初始值中是否包含模板字段（仅 lexical JSON 形态可检测）。 */
function hasTemplateFieldsIn(
  value: ParsedInitialValue | undefined,
): boolean | undefined {
  if (value?.type !== 'lexical') {
    return undefined;
  }
  try {
    return hasTemplateFields(JSON.parse(value.text) as SerializedEditorState);
  } catch {
    return false;
  }
}

/**
 * 轻量级编辑器组件。
 * 与完整 Editor 相比去除了工具栏、评论面板、目录、浮动工具栏等重型 UI 组件，
 * 仅保留核心编辑能力和必要的插件扩展，适用于嵌入场景。
 *
 * @example
 * ```tsx
 * import { LightEditor } from '@leditor/lexical-editor';
 *
 * <LightEditor
 *   initialValue="# Hello World"
 *   onChange={(value) => console.log(value)}
 * />
 * ```
 */
export function LightEditor({
  initialValue,
  onChange,
  media,
  embed,
  placeholder = '开始输入...',
  locale = 'zh-CN',
  readOnly = false,
  mode: modeProp,
}: LightEditorProps) {
  const parsedInitialValue = useMemo(
    () => parseInitialValue(initialValue),
    [initialValue],
  );

  // 模式归一化：mode 优先；未传时由 readOnly 推导
  const mode: EditorMode = modeProp ?? (readOnly ? 'readonly' : 'edit');

  // 「当前文档是否为模板」：由 TemplateFieldsWatcher 跟随编辑器内容实时更新。
  // 初始值从 parsedInitialValue（序列化 Form）先行判断，避免挂载瞬间误判。
  const [hasTemplateFields, setHasTemplateFields] = useState(
    () => hasTemplateFieldsIn(parsedInitialValue) ?? false,
  );

  // editor 可编辑性——
  // - design：始终可编辑（模板设计）。
  // - edit：若文档为模板（含可填写字段），整体锁定、仅字段控件可交互；
  //   普通文档（无字段）保持完全自由编辑（不破坏既有用法）。
  // - readonly / readOnly prop：整体不可编辑。
  const editable =
    mode === 'readonly' || readOnly
      ? false
      : mode === 'design'
        ? true
        : !hasTemplateFields;

  // 工具栏显示策略：
  // - design：显示（插入字段依赖工具栏）。
  // - edit：模板文档隐藏工具栏，普通文档保持可见。
  // - readonly / readOnly prop：隐藏。
  const showToolbar =
    !readOnly &&
    mode !== 'readonly' &&
    (mode === 'design' || !hasTemplateFields);

  // 将序列化回调转换为 OnChangeCallback。
  // 使用 requestAnimationFrame 延迟调用 onChange，避免在 React 批量更新期间
  // 触发表单重渲染导致编辑器 DOM 重建、焦点丢失（光标跳到末尾）。
  const onChangeWrapperRef = useRef<OnChangeCallback | undefined>(undefined);
  onChangeWrapperRef.current = (editorState) => {
    const value = editorState.toJSON();
    requestAnimationFrame(() => {
      onChange?.(value);
    });
  };

  const editorExtension = useMemo(
    () =>
      createEditorConfig({
        initialValue: parsedInitialValue as ParsedInitialValue,
        onChange: onChangeWrapperRef.current,
        editable: editable,
        embed,
      }),
    [parsedInitialValue, editable, embed],
  );

  const contentEditable = (
    <ContentEditable
      className="outline-none min-h-full leading-relaxed"
      aria-placeholder={placeholder}
      placeholder={
        <div className="pointer-events-none absolute top-3  text-gray-400">
          {placeholder}
        </div>
      }
    />
  );

  return (
    <LocaleContext.Provider value={locale}>
      <EditorConfigProvider embed={embed} media={media} mode={mode}>
        <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <LexicalExtensionComposer extension={editorExtension}>
            <ReadOnlySync readOnly={!editable} />
            <ModeSync mode={mode} />
            <TemplateFieldsWatcher onHasFields={setHasTemplateFields} />
            {showToolbar && <LightToolbar />}
            <div className="flex flex-1 overflow-hidden">
              <div className="relative min-h-80 flex-1">
                <div className="absolute inset-0 overflow-y-auto p-3">
                  {contentEditable}
                </div>
              </div>
            </div>
          </LexicalExtensionComposer>
        </div>
      </EditorConfigProvider>
    </LocaleContext.Provider>
  );
}

/** 创建共享的 Lexical 编辑器扩展配置 */
function createEditorConfig(config: {
  initialValue?: ParsedInitialValue;
  onChange?: OnChangeCallback;
  editable?: boolean;
  embed?: EmbedConfig;
}) {
  const { initialValue, onChange, editable = true, embed } = config;

  return defineExtension({
    name: '@leditor/root',
    namespace: 'leditor',
    theme: editorTheme,
    editable,
    nodes: [
      ImageNode,
      VideoNode,
      AudioNode,
      FileNode,
      HorizontalRuleNode,
      ListStyleNode,
      RubyNode,
      EquationNode,
      MermaidNode,
      CalloutNode,
      CodeDrawingNode,
      DrawioNode,
      MindNode,
      TemplateFieldNode,
    ],
    dependencies: [
      // 将粘贴的 HTML 路由到新版 DOMImport 管线，保留 inline 样式
      ClipboardDOMImportExtension,
      // 渲染自定义的 ContentEditable
      configExtension(ReactExtension, { contentEditable: null }),
      AutoFocusExtension,
      RichTextExtension,
      HistoryExtension,
      ListExtension,
      CheckListExtension,
      configExtension(AutoLinkExtension, {
        matchers: MATCHERS,
        excludeParents: EXCLUDE_PARENTS,
      }),
      TableExtension,
      TabIndentationExtension,
      HorizontalRuleExtension,
      CodeExtension,
      MarkdownShortcutExtension,
      configExtension(InitialValueExtension, { initialValue }),
      configExtension(OnChangeExtension, {
        onChangeRef: { current: onChange },
      }),
      InsertImageExtension,
      InsertVideoExtension,
      InsertAudioExtension,
      InsertEquationExtension,
      InsertFileExtension,
      CodeHighlightExtension,
      CodePasteExtension,
      ExcelTablePasteExtension,
      UniversalBlockEscapeExtension,
      TableScrollShadowExtension,
      TableDragSelectFixExtension,
      CalloutExtension,
      MermaidExtension,
      CodeDrawingExtension,
      TableInsertExtension,
      CodeBlockExtension,
      ...[
        embed?.drawio ? DrawioExtension : null,
        embed?.mind ? MindExtension : null,
      ].filter(
        (ext): ext is typeof DrawioExtension | typeof MindExtension =>
          ext !== null,
      ),
      UploadImagesExtension,
      PasteMediaExtension,
      TableActionMenuExtension,
      TableCellResizerExtension,
      TemplateFieldExtension,
    ],
  });
}

export { INSERT_AUDIO_COMMAND, INSERT_IMAGE_COMMAND, INSERT_VIDEO_COMMAND };
export type {
  InsertAudioPayload,
  InsertImagePayload,
  InsertVideoPayload,
  MediaConfig,
  EmbedConfig,
};

export default LightEditor;
