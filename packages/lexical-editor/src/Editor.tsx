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
import './checklist.css';
import './table-scroll-shadow.css';
import {
  type EditorState,
  type LexicalEditor,
  configExtension,
  defineExtension,
} from 'lexical';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EXCLUDE_PARENTS, MATCHERS } from './plugins/AutoLinkPlugin';
import { FloatingBlockActionsPlugin } from './ui/BlockActions';
import { CalloutNode } from './nodes/CalloutNode';
import { CalloutPlugin } from './plugins/CalloutPlugin';
import { CodeBlockPlugin } from './plugins/CodeBlockPlugin';
import { CodeDrawingNode } from './nodes/CodeDrawingNode';
import { CodeDrawingPlugin } from './plugins/CodeDrawingPlugin';
import { CodeHighlightExtension } from './plugins/CodeHighlightPlugin';
import { CodePastePlugin } from './plugins/CodePastePlugin';
import { EquationNode } from './nodes/EquationNode';
import { ExcelTablePastePlugin } from './plugins/ExcelTablePastePlugin';
import { FileNode } from './nodes/FileNode';
import { FloatingTableActionsPlugin } from './ui/FloatingTableActions';
import { FloatingToolbar } from './ui/FloatingToolbar';
import { ImageNode } from './nodes/ImageNode';
import { ListStyleNode } from './nodes/ListStyleNode';
import { LocaleContext } from './LocaleContext';
import { MarkdownShortcutExtension } from './plugins/MarkdownShortcutExtension';
import { MermaidNode } from './nodes/MermaidNode';
import { MermaidPlugin } from './plugins/MermaidPlugin';
import { PasteMediaPlugin } from './plugins/PasteMediaPlugin';
import { RubyNode } from './nodes/RubyNode';
import { SlashCommandsHost } from './ui/SlashCommandsHost';
import { TableActionMenuPlugin } from './plugins/TableActionMenuPlugin';
import TableCellResizerPlugin from './plugins/TableCellResizerPlugin';
import { TableDragSelectFix } from './plugins/TableDragSelectFix';
import { TableOfContents } from './ui/TableOfContents';
import { TablePlugin } from './plugins/TablePlugin';
import { TableScrollShadowPlugin } from './plugins/TableScrollShadowPlugin';
import { UniversalBlockEscapePlugin } from './plugins/UniversalBlockEscapePlugin';
import { UploadImagesPlugin } from './plugins/UploadImagesPlugin';
import {
  INSERT_AUDIO_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_VIDEO_COMMAND,
  type InsertAudioPayload,
  type InsertImagePayload,
  type InsertVideoPayload,
} from './commands';
import { CommentPanel } from './comment/CommentPanel';
import { CommentPlugin } from './comment/CommentPlugin';
import { DrawioNode } from './nodes/DrawioNode';
import { DrawioPlugin } from './plugins/DrawioPlugin';
import { EmbedConfigProvider } from './embed/EmbedConfigContext';
import { MindNode } from './nodes/MindNode';
import { MindPlugin } from './plugins/MindPlugin';
import type { EmbedConfig } from './embed/config';
import {
  HorizontalRuleExtension,
  InitialValueExtension,
  InsertAudioExtension,
  InsertEquationExtension,
  InsertFileExtension,
  InsertImageExtension,
  InsertVideoExtension,
  type OnChangeCallback,
  OnChangeExtension,
} from './extensions';
import { FindReplaceDialog } from './find/FindReplaceDialog';
import type { Locale } from './i18n';
import { AudioNode } from './nodes/AudioNode';
import { MediaConfigProvider } from './media/MediaConfigContext';
import { VideoNode } from './nodes/VideoNode';
import type { MediaConfig } from './media/config';
import { editorTheme } from './theme';
import { Toolbar } from './toolbar/Toolbar';

export interface EditorProps {
  initialValue?: string;
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  /** 统一的图片/视频/音频上传下载配置。未配置上传 URL 时禁用文件上传。 */
  media?: MediaConfig;
  /** 外部 iframe 嵌入服务配置（Draw.io / 思维导图）。未配置 drawio 时使用公共嵌入服务；思维导图需显式配置。 */
  embed?: EmbedConfig;
  placeholder?: string;
  /** Enable the table-of-contents feature. Defaults to `true`. */
  toc?: boolean;
  /** Initial locale. Defaults to `'zh-CN'`. */
  locale?: Locale;
  /** Called when the locale changes. */
  onLocaleChange?: (locale: Locale) => void;
  /**
   * Controlled read-only state. When provided, the editor is fully controlled
   * by the caller; otherwise the toolbar toggles it internally.
   * The toolbar is hidden while read-only. Defaults to `false`.
   */
  readOnly?: boolean;
  /** Called when the read-only state changes. */
  onReadOnlyChange?: (readOnly: boolean) => void;
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

export function Editor({
  initialValue,
  onChange,
  media,
  embed,
  placeholder = 'Start writing…',
  toc = true,
  locale: initialLocale = 'zh-CN',
  onLocaleChange,
  readOnly: readOnlyProp,
  onReadOnlyChange,
}: EditorProps) {
  const onChangeRef = useRef<OnChangeCallback | undefined>(onChange);
  onChangeRef.current = onChange;
  const [pinned, setPinned] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  // 传入 readOnly prop 时为受控模式,以外部值为准;否则内部自管(非受控)。
  const [internalReadOnly, setInternalReadOnly] = useState(false);
  const readOnly = readOnlyProp ?? internalReadOnly;
  // 初始只读状态仅在首次挂载时生效,后续切换由 ReadOnlySync 通过 setEditable 控制。
  const initialReadOnlyRef = useRef(readOnlyProp ?? false);
  // 作为浮动工具栏 / 块操作等浮动元素的定位锚点
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [floatingAnchor, setFloatingAnchor] = useState<HTMLDivElement | null>(
    null,
  );

  useEffect(() => {
    setFloatingAnchor(editorContainerRef.current);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    onLocaleChange?.(newLocale);
  };

  const handleReadOnlyChange = (newReadOnly: boolean) => {
    if (readOnlyProp === undefined) {
      setInternalReadOnly(newReadOnly);
    }
    onReadOnlyChange?.(newReadOnly);
  };

  const contentEditable = (
    <ContentEditable
      className="outline-none min-h-full leading-relaxed pl-14"
      aria-placeholder={placeholder}
      placeholder={
        <div className="pointer-events-none absolute top-3 left-14 text-gray-400">
          {placeholder}
        </div>
      }
    />
  );

  const editorExtension = useMemo(
    () =>
      defineExtension({
        name: '@leditor/root',
        namespace: 'leditor',
        theme: editorTheme,
        // 初始可编辑状态与 readOnly 相反
        editable: !initialReadOnlyRef.current,
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
        ],
        dependencies: [
          // 将粘贴的 HTML 路由到新版 DOMImport 管线，保留 inline 样式（color、font-size 等）
          ClipboardDOMImportExtension,
          // Render our own ContentEditable inside the custom layout below.
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
          configExtension(OnChangeExtension, { onChangeRef }),
          InsertImageExtension,
          InsertVideoExtension,
          InsertAudioExtension,
          InsertEquationExtension,
          InsertFileExtension,
          CodeHighlightExtension,
        ],
      }),
    [initialValue],
  );

  return (
    <LocaleContext.Provider value={locale}>
      <MediaConfigProvider config={media}>
        <EmbedConfigProvider config={embed}>
          <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <LexicalExtensionComposer extension={editorExtension}>
              <ReadOnlySync readOnly={readOnly} />
              {!readOnly && (
                <Toolbar
                  toc={toc}
                  onTogglePin={() => setPinned(() => !pinned)}
                  pinned={pinned}
                  showComments={showComments}
                  onToggleComments={() => setShowComments((v) => !v)}
                  onToggleFindReplace={() => setFindReplaceOpen((v) => !v)}
                  locale={locale}
                  onLocaleChange={handleLocaleChange}
                  readOnly={readOnly}
                  onReadOnlyChange={handleReadOnlyChange}
                />
              )}
              <div className="flex flex-1 overflow-hidden">
                <div className="relative min-h-80 flex-1">
                  <div
                    ref={editorContainerRef}
                    className="absolute inset-0 overflow-y-auto py-3 pr-3"
                  >
                    {contentEditable}
                  </div>
                  {toc && !pinned && <TableOfContents pinned={pinned} />}
                </div>
                {toc && pinned && <TableOfContents pinned={pinned} />}
                {/* showComments 控制面板是否挂载;无评论时 CommentPanel 内部返回 null */}
                {showComments && <CommentPanel />}
              </div>
              <TablePlugin />
              <TableActionMenuPlugin />
              <TableCellResizerPlugin />
              <TableScrollShadowPlugin />
              <FloatingTableActionsPlugin />
              <TableDragSelectFix />
              <CommentPlugin />
              <CodeBlockPlugin />
              <FloatingBlockActionsPlugin />
              <SlashCommandsHost />
              <CodePastePlugin />
              <MermaidPlugin />
              <CalloutPlugin />
              <CodeDrawingPlugin />
              <DrawioPlugin />
              <MindPlugin />
              <UploadImagesPlugin />
              <PasteMediaPlugin />
              <ExcelTablePastePlugin />
              {floatingAnchor && (
                <FloatingToolbar anchorElem={floatingAnchor} />
              )}
              <UniversalBlockEscapePlugin />
              <FindReplaceDialog
                open={findReplaceOpen}
                onOpenChange={setFindReplaceOpen}
              />
            </LexicalExtensionComposer>
          </div>
        </EmbedConfigProvider>
      </MediaConfigProvider>
    </LocaleContext.Provider>
  );
}

export { INSERT_AUDIO_COMMAND, INSERT_IMAGE_COMMAND, INSERT_VIDEO_COMMAND };

export type {
  InsertAudioPayload,
  InsertImagePayload,
  InsertVideoPayload,
  MediaConfig,
  EmbedConfig,
};

export default Editor;
