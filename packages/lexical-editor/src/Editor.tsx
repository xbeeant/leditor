import { CodeExtension } from '@lexical/code-core';
import {
  AutoFocusExtension,
  TabIndentationExtension,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { CheckListExtension, ListExtension } from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { RichTextExtension } from '@lexical/rich-text';
import { TableExtension } from '@lexical/table';
import {
  type EditorState,
  type LexicalEditor,
  configExtension,
  defineExtension,
} from 'lexical';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FloatingBlockActionsPlugin } from './BlockActions';
import { CodeBlockPlugin } from './CodeBlockPlugin';
import { CodeHighlightExtension } from './CodeHighlightPlugin';
import { EquationNode } from './EquationNode';
import { FloatingTableActionsPlugin } from './FloatingTableActions';
import { ImageNode } from './ImageNode';
import { ListStyleNode } from './ListStyleNode';
import { LocaleContext } from './LocaleContext';
import { MarkdownShortcutExtension } from './MarkdownShortcutExtension';
import { RubyNode } from './RubyNode';
import { SlashCommandsHost } from './SlashCommandsHost';
import { TableActionMenuPlugin } from './TableActionMenuPlugin';
import TableCellResizerPlugin from './TableCellResizerPlugin';
import { TableDragSelectFix } from './TableDragSelectFix';
import { TableOfContents } from './TableOfContents';
import { TablePlugin } from './TablePlugin';
import { UploadImagesPlugin } from './UploadImagesPlugin';
import { INSERT_IMAGE_COMMAND, type InsertImagePayload } from './commands';
import { CommentExtension } from './comment/CommentExtension';
import { CommentPanel } from './comment/CommentPanel';
import { CommentPlugin } from './comment/CommentPlugin';
import {
  HorizontalRuleExtension,
  InitialValueExtension,
  InsertEquationExtension,
  InsertImageExtension,
  type OnChangeCallback,
  OnChangeExtension,
} from './extensions';
import { FindReplaceDialog } from './find/FindReplaceDialog';
import type { Locale } from './i18n';
import { editorTheme } from './theme';
import { Toolbar } from './toolbar/Toolbar';

export interface EditorProps {
  initialValue?: string;
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
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
          HorizontalRuleNode,
          ListStyleNode,
          RubyNode,
          EquationNode,
        ],
        dependencies: [
          // Render our own ContentEditable inside the custom layout below.
          configExtension(ReactExtension, { contentEditable: null }),
          AutoFocusExtension,
          RichTextExtension,
          HistoryExtension,
          ListExtension,
          CheckListExtension,
          LinkExtension,
          TableExtension,
          TabIndentationExtension,
          HorizontalRuleExtension,
          CodeExtension,
          MarkdownShortcutExtension,
          configExtension(InitialValueExtension, { initialValue }),
          configExtension(OnChangeExtension, { onChangeRef }),
          InsertImageExtension,
          InsertEquationExtension,
          CodeHighlightExtension,
          CommentExtension,
        ],
      }),
    [initialValue],
  );

  return (
    <LocaleContext.Provider value={locale}>
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
              <div className="absolute inset-0 overflow-y-auto py-3 pr-3">
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
          <FloatingTableActionsPlugin />
          <TableDragSelectFix />
          <CommentPlugin />
          <CodeBlockPlugin />
          <FloatingBlockActionsPlugin />
          <SlashCommandsHost />
          <UploadImagesPlugin />
          <FindReplaceDialog
            open={findReplaceOpen}
            onOpenChange={setFindReplaceOpen}
          />
        </LexicalExtensionComposer>
      </div>
    </LocaleContext.Provider>
  );
}

export { INSERT_IMAGE_COMMAND };

export type { InsertImagePayload };

export default Editor;
