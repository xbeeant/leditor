import { $isMarkNode } from '@lexical/mark';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $isElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UNWRAP_MARK_COMMAND } from './commentCommands';
import { timeAgo } from './format';
import { mockCommentsApi } from './mockApi';
import type { CommentData } from './types';

interface PanelThread {
  threadID: string;
  /** The highlighted text this thread is attached to (from the editor). */
  quote: string;
  comments: CommentData[];
  /** Editor key of the MarkNode, used to locate/scroll to the range. */
  markKey: string | null;
}

/** Collect every MarkNode in the tree: threadID -> quote text + mark key. */
function $collectMarkThreads(): Record<
  string,
  { quote: string; markKey: string }
> {
  const threads: Record<string, { quote: string; markKey: string }> = {};
  const visit = (node: LexicalNode) => {
    if ($isMarkNode(node)) {
      const quote = node.getTextContent();
      for (const id of node.getIDs()) {
        threads[id] = { quote, markKey: node.getKey() };
      }
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        visit(child);
      }
    }
  };
  for (const child of $getRoot().getChildren()) {
    visit(child);
  }
  return threads;
}

function latestTime(comments: CommentData[]): number {
  return comments.reduce(
    (max, c) => Math.max(max, new Date(c.createdAt).getTime()),
    0,
  );
}

/**
 * Stable signature of every mark thread (id + quote text + mark key).
 * Used to detect whether the mark structure *actually* changed (thread
 * added/removed, or the quoted text was edited) so we only refresh the
 * panel when needed instead of on every editor update (i.e. every keystroke).
 */
function readMarkSignature(editor: LexicalEditor): string {
  return editor.getEditorState().read(
    () => {
      const threads = $collectMarkThreads();
      return Object.keys(threads)
        .sort()
        .map(
          (id) => `${id}\u0000${threads[id].quote}\u0000${threads[id].markKey}`,
        )
        .join('|');
    },
    { editor },
  );
}

/**
 * Right-hand comment list panel, styled like the pinned table of contents.
 * Shows every comment thread in the document; clicking a thread scrolls to
 * (and selects) the highlighted range so the bubble opens there too.
 */
export function CommentPanel() {
  const [editor] = useLexicalComposerContext();
  const [threads, setThreads] = useState<PanelThread[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const markSignatureRef = useRef<string | null>(null);
  const refreshTokenRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!mounted.current) {
      return;
    }
    const token = ++refreshTokenRef.current;
    // Only show the full-height spinner on the first load; background
    // refreshes (e.g. editing the highlighted text) must not flicker.
    if (!loadedOnceRef.current) {
      setLoading(true);
    }
    try {
      const markThreads = editor
        .getEditorState()
        .read(() => $collectMarkThreads());
      const all = await mockCommentsApi.fetchComments();
      if (!mounted.current || token !== refreshTokenRef.current) {
        return;
      }
      const grouped: Record<string, CommentData[]> = {};
      for (const comment of all) {
        (grouped[comment.threadID] ??= []).push(comment);
      }
      const list: PanelThread[] = Object.entries(grouped).map(
        ([threadID, comments]) => ({
          threadID,
          comments: comments.sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          ),
          quote: markThreads[threadID]?.quote ?? '',
          markKey: markThreads[threadID]?.markKey ?? null,
        }),
      );
      list.sort((a, b) => latestTime(b.comments) - latestTime(a.comments));
      setThreads(list);
    } finally {
      if (mounted.current && token === refreshTokenRef.current) {
        loadedOnceRef.current = true;
        setLoading(false);
      }
    }
  }, [editor]);

  // Refresh when the comment store changes (reply / delete from the bubble)
  // or when the mark structure actually changed (thread added/removed or the
  // quoted text was edited) — NOT on every editor update / keystroke.
  useEffect(() => {
    mounted.current = true;
    markSignatureRef.current = readMarkSignature(editor);
    refresh();
    const unregisterUpdate = editor.registerUpdateListener(() => {
      const signature = readMarkSignature(editor);
      if (signature !== markSignatureRef.current) {
        markSignatureRef.current = signature;
        refresh();
      }
    });
    const onStoreChange = () => refresh();
    window.addEventListener('leditor:comments-changed', onStoreChange);
    return () => {
      mounted.current = false;
      unregisterUpdate();
      window.removeEventListener('leditor:comments-changed', onStoreChange);
    };
  }, [editor, refresh]);

  const handleJump = (thread: PanelThread) => {
    if (!thread.markKey) {
      return;
    }
    const element = editor.getElementByKey(thread.markKey);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const handleDelete = async (comment: CommentData) => {
    await mockCommentsApi.deleteComment(comment.id);
    const remaining = await mockCommentsApi.fetchComments(comment.threadID);
    if (remaining.length === 0) {
      editor.dispatchCommand(UNWRAP_MARK_COMMAND, comment.threadID);
    }
    await refresh();
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50/50">
      <div className="flex items-center gap-1.5 px-5 pt-5 pb-2">
        <MessageSquare size={14} className="text-gray-700" />
        <span className="text-sm font-medium text-gray-900">Comments</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm leading-relaxed text-gray-400">
            No comments yet. Select some text and use the toolbar to start a
            discussion.
          </p>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.threadID}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              <button
                type="button"
                onClick={() => handleJump(thread)}
                className="block w-full truncate text-left text-xs italic text-gray-400 hover:text-blue-500"
                title={thread.quote ? `"${thread.quote}"` : 'Highlighted text'}
              >
                &ldquo;{thread.quote || 'Highlighted text'}&rdquo;
              </button>
              <div className="mt-2 space-y-2">
                {thread.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-gray-50 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        {comment.author}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">
                          {timeAgo(comment.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(comment)}
                          className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title="Delete comment"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
                      {comment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
