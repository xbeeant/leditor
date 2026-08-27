import { CodeExtension } from '@lexical/code-core';
import {
  AutoFocusExtension,
  TabIndentationExtension,
} from '@lexical/extension';
import { HistoryExtension } from '@lexical/history';
import { LinkExtension } from '@lexical/link';
import { ListExtension } from '@lexical/list';
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
import { useMemo, useRef, useState } from 'react';
import { CodeHighlightExtension } from './CodeHighlightPlugin';
import { FloatingTableActionsPlugin } from './FloatingTableActions';
import { ImageNode } from './ImageNode';
import { MarkdownShortcutExtension } from './MarkdownShortcutExtension';
import { TableActionMenuPlugin } from './TableActionMenuPlugin';
import { TableDragSelectFix } from './TableDragSelectFix';
import { TableOfContents } from './TableOfContents';
import { INSERT_IMAGE_COMMAND, type InsertImagePayload } from './commands';
import { CommentExtension } from './comment/CommentExtension';
import { CommentPanel } from './comment/CommentPanel';
import { CommentPlugin } from './comment/CommentPlugin';
import {
  HorizontalRuleExtension,
  InitialValueExtension,
  InsertImageExtension,
  type OnChangeCallback,
  OnChangeExtension,
} from './extensions';
import { editorTheme } from './theme';
import { Toolbar } from './toolbar/Toolbar';

export interface EditorProps {
  initialValue?: string;
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  placeholder?: string;
  /** Enable the table-of-contents feature. Defaults to `true`. */
  toc?: boolean;
}

export function Editor({
  initialValue,
  onChange,
  placeholder = 'Start writing…',
  toc = true,
}: EditorProps) {
  const onChangeRef = useRef<OnChangeCallback | undefined>(onChange);
  onChangeRef.current = onChange;
  const [pinned, setPinned] = useState(false);
  const [showComments, setShowComments] = useState(true);

  const contentEditable = (
    <ContentEditable
      className="outline-none min-h-full leading-relaxed"
      aria-placeholder={placeholder}
      placeholder={
        <div className="pointer-events-none absolute top-3 left-3 text-gray-400">
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
        nodes: [ImageNode, HorizontalRuleNode],
        dependencies: [
          // Render our own ContentEditable inside the custom layout below.
          configExtension(ReactExtension, { contentEditable: null }),
          AutoFocusExtension,
          RichTextExtension,
          HistoryExtension,
          ListExtension,
          LinkExtension,
          TableExtension,
          TabIndentationExtension,
          HorizontalRuleExtension,
          CodeExtension,
          MarkdownShortcutExtension,
          configExtension(InitialValueExtension, { initialValue }),
          configExtension(OnChangeExtension, { onChangeRef }),
          InsertImageExtension,
          CodeHighlightExtension,
          CommentExtension,
        ],
      }),
    [initialValue],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <LexicalExtensionComposer extension={editorExtension}>
        <Toolbar
          toc={toc}
          onTogglePin={() => setPinned(() => !pinned)}
          pinned={pinned}
          showComments={showComments}
          onToggleComments={() => setShowComments((v) => !v)}
        />
        <div className="flex flex-1 overflow-hidden">
          <div className="relative min-h-80 flex-1">
            <div className="absolute inset-0 overflow-y-auto p-3">
              {contentEditable}
            </div>
            {toc && !pinned && <TableOfContents pinned={pinned} />}
          </div>
          {toc && pinned && <TableOfContents pinned={pinned} />}
          {showComments && <CommentPanel />}
        </div>
        <TableActionMenuPlugin />
        <FloatingTableActionsPlugin />
        <TableDragSelectFix />
        <CommentPlugin />
      </LexicalExtensionComposer>
    </div>
  );
}

export { INSERT_IMAGE_COMMAND };

export type { InsertImagePayload };

export default Editor;
