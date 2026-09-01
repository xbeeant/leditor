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
import { LocaleContext } from './LocaleContext';
import {
  INSERT_AUDIO_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_VIDEO_COMMAND,
  type InsertAudioPayload,
  type InsertImagePayload,
  type InsertVideoPayload,
} from './commands';
import { CommentPlugin } from './comment';
import { CommentPanel } from './comment/CommentPanel';
import { EmbedConfigProvider } from './embed';
import type { EmbedConfig } from './embed';
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
import { FindReplaceDialog } from './find';
import type { Locale } from './i18n';
import { MediaConfigProvider } from './media';
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
import { EXCLUDE_PARENTS, MATCHERS } from './plugins';
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
import { MarkdownShortcutExtension } from './plugins/MarkdownShortcutExtension';
import { editorTheme } from './theme';
import { Toolbar } from './toolbar/Toolbar';
import { FloatingBlockActionsPlugin } from './ui';
import { FloatingTableActionsPlugin } from './ui';
import { FloatingToolbar } from './ui';
import { SlashCommandsHost } from './ui';
import { TableOfContents } from './ui';

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
          DrawioExtension,
          MindExtension,
          UploadImagesExtension,
          PasteMediaExtension,
          TableActionMenuExtension,
          TableCellResizerExtension,
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
              <FloatingTableActionsPlugin />
              <CommentPlugin />
              <FloatingBlockActionsPlugin />
              <SlashCommandsHost />
              {floatingAnchor && (
                <FloatingToolbar anchorElem={floatingAnchor} />
              )}
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
