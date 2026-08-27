import { $getMarkIDs, $wrapSelectionInMarkNode } from '@lexical/mark';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createRangeSelection,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  type RangeSelection,
} from 'lexical';
import { Loader2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  TOGGLE_COMMENT_INPUT_COMMAND,
  UNWRAP_MARK_COMMAND,
  WRAP_SELECTION_IN_MARK_COMMAND,
} from './commentCommands';
import { timeAgo } from './format';
import { mockCommentsApi } from './mockApi';
import type { CommentData } from './types';

/** Broadcast when the comment store changes so panels can refresh. */
export function notifyCommentsChanged(): void {
  window.dispatchEvent(new Event('leditor:comments-changed'));
}

interface SavedPoint {
  key: string;
  offset: number;
  type: 'text' | 'element';
}

interface SavedSelection {
  anchor: SavedPoint;
  focus: SavedPoint;
}

interface Position {
  top: number;
  left: number;
}

/** Viewport-space rect of the current selection (top / left / bottom). */
interface AnchorRect {
  top: number;
  left: number;
  bottom: number;
}

interface BubbleState {
  threadID: string;
  rect: AnchorRect;
}

/** Gap between the popover and the selection it anchors to. */
const POPOVER_GAP = 12;

/**
 * Fit a fixed-position popover inside the viewport. `preferAbove` keeps the
 * default side (above the selection for the bubble, below for the composer)
 * and flips to the other side only when there is not enough space.
 */
function fitPopover(
  anchor: AnchorRect,
  width: number,
  height: number,
  preferAbove: boolean,
): Position {
  const gap = POPOVER_GAP;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fitsAbove = anchor.top - gap - height >= gap;
  const fitsBelow = anchor.bottom + gap + height <= vh - gap;
  let top: number;
  if (preferAbove) {
    top = fitsAbove
      ? anchor.top - gap - height
      : anchor.bottom + gap; // flip below when no room above
  } else {
    top = fitsBelow
      ? anchor.bottom + gap
      : anchor.top - gap - height; // flip above when no room below
  }
  // Keep the whole popover inside the viewport vertically and horizontally.
  top = Math.max(gap, Math.min(top, vh - height - gap));
  const left = Math.max(gap, Math.min(anchor.left, vw - width - gap));
  return { top, left };
}

function getSelectionRect(): DOMRect | null {
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) {
    return null;
  }
  const rect = domSelection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return rect;
}

function restoreSelection(saved: SavedSelection): RangeSelection {
  const selection = $createRangeSelection();
  selection.anchor.set(saved.anchor.key, saved.anchor.offset, saved.anchor.type);
  selection.focus.set(saved.focus.key, saved.focus.offset, saved.focus.type);
  $setSelection(selection);
  return selection;
}

/**
 * Comment UI: select text -> open the comment composer (from the toolbar),
 * save via the mock API and highlight the range. Clicking a highlighted range
 * shows the thread bubble where comments can be viewed, replied to or deleted.
 */
export function CommentPlugin() {
  const [editor] = useLexicalComposerContext();
  const savedSelection = useRef<SavedSelection | null>(null);
  /** Thread whose comments were last loaded, so typing inside a mark
   *  doesn't re-fetch on every keystroke. */
  const loadedThreadRef = useRef<string | null>(null);

  const [inputOpen, setInputOpen] = useState(false);
  const [inputPos, setInputPos] = useState<DOMRect | null>(null);
  const [inputText, setInputText] = useState('');
  const [inputSaving, setInputSaving] = useState(false);
  const [inputFinalPos, setInputFinalPos] = useState<Position | null>(null);
  const inputRef = useRef<HTMLDivElement | null>(null);

  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [bubblePos, setBubblePos] = useState<Position | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  const loadComments = useCallback(async (threadID: string) => {
    setLoading(true);
    try {
      setComments(await mockCommentsApi.fetchComments(threadID));
    } finally {
      setLoading(false);
    }
  }, []);

  const openInput = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        return;
      }
      const { anchor, focus } = selection;
      savedSelection.current = {
        anchor: { key: anchor.key, offset: anchor.offset, type: anchor.type },
        focus: { key: focus.key, offset: focus.offset, type: focus.type },
      };
      setInputPos(getSelectionRect());
      setInputOpen(true);
    });
  }, [editor]);

  // Toggle the comment composer (dispatched from the toolbar button).
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_COMMENT_INPUT_COMMAND,
      (open) => {
        if (open) {
          openInput();
        } else {
          setInputOpen(false);
        }
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, openInput]);

  // Clicking a highlighted range opens the comment thread bubble.
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!selection || !$isRangeSelection(selection)) {
          loadedThreadRef.current = null;
          setBubble((prev) => (prev ? null : prev));
          return;
        }
        const anchor = selection.anchor;
        const node =
          anchor.type === 'text' ? anchor.getNode() : undefined;
        const ids = node ? $getMarkIDs(node, anchor.offset) : null;
        if (ids && ids.length > 0) {
          const threadID = ids[0];
          const rect = getSelectionRect();
          setBubble((prev) =>
            prev && prev.threadID === threadID
              ? prev
              : rect
                ? {
                    threadID,
                    rect: {
                      top: rect.top,
                      left: rect.left,
                      bottom: rect.bottom,
                    },
                  }
                : prev,
          );
          // Load once per thread; add/reply/delete flows already reload
          // explicitly, so typing inside a mark won't re-fetch on each key.
          if (threadID !== loadedThreadRef.current) {
            loadedThreadRef.current = threadID;
            loadComments(threadID);
          }
        } else {
          loadedThreadRef.current = null;
          setBubble((prev) => (prev ? null : prev));
        }
      });
    });
  }, [editor, inputOpen, loadComments]);

  const handleAddComment = async () => {
    const text = inputText.trim();
    if (!text || !savedSelection.current || inputSaving) {
      return;
    }
    setInputSaving(true);
    try {
      const threadID = `comment-${Date.now()}`;
      await mockCommentsApi.createComment({ threadID, text });
      editor.update(() => {
        const current = $getSelection();
        const target =
          $isRangeSelection(current) && !current.isCollapsed()
            ? current
            : restoreSelection(savedSelection.current!);
        $wrapSelectionInMarkNode(target, target.isBackward(), threadID);
      });
      setInputOpen(false);
      setInputText('');
      savedSelection.current = null;
      if (inputPos) {
        setBubble({
          threadID,
          rect: {
            top: inputPos.top,
            left: inputPos.left,
            bottom: inputPos.bottom,
          },
        });
      }
      setComments(await mockCommentsApi.fetchComments(threadID));
      notifyCommentsChanged();
    } finally {
      setInputSaving(false);
    }
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text || !bubble || replySaving) {
      return;
    }
    setReplySaving(true);
    try {
      await mockCommentsApi.createComment({ threadID: bubble.threadID, text });
      setReplyText('');
      await loadComments(bubble.threadID);
      notifyCommentsChanged();
    } finally {
      setReplySaving(false);
    }
  };

  const handleDelete = async (comment: CommentData) => {
    await mockCommentsApi.deleteComment(comment.id);
    const remaining = await mockCommentsApi.fetchComments(comment.threadID);
    if (remaining.length === 0) {
      editor.dispatchCommand(UNWRAP_MARK_COMMAND, comment.threadID);
      setBubble(null);
      setComments([]);
    } else {
      setComments(remaining);
    }
    notifyCommentsChanged();
  };

  // Measure the popovers and keep them fully inside the viewport:
  // the bubble prefers to sit above the selection, the composer below it,
  // and each flips to the other side when there is no room (e.g. selection
  // at the very top / bottom of the screen).
  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!bubble) {
      setBubblePos(null);
      return;
    }
    if (!el) {
      return;
    }
    const update = () => {
      setBubblePos(
        fitPopover(bubble.rect, el.offsetWidth, el.offsetHeight, true),
      );
    };
    update();
    // Re-fit whenever the popover's size changes (e.g. comments finish
    // loading and the list grows taller) or the window resizes, so the
    // bubble never overflows the viewport bottom / top.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [bubble]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!inputOpen || !inputPos) {
      setInputFinalPos(null);
      return;
    }
    if (!el) {
      return;
    }
    const anchor = {
      top: inputPos.top,
      left: inputPos.left,
      bottom: inputPos.bottom,
    };
    const update = () => {
      setInputFinalPos(
        fitPopover(anchor, el.offsetWidth, el.offsetHeight, false),
      );
    };
    update();
    // Same as the bubble: keep the composer fully inside the viewport even
    // if its size changes or the window resizes.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [inputOpen, inputPos]);

  return createPortal(
    <>
      {inputOpen && inputPos && (
        <div
          ref={inputRef}
          className="fixed z-50 w-72"
          style={{
            top: inputFinalPos?.top ?? -9999,
            left: inputFinalPos?.left ?? -9999,
          }}
        >
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <MessageSquare size={14} />
                Add comment
              </span>
              <button
                type="button"
                onClick={() => setInputOpen(false)}
                className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Write a comment…"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-blue-400"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInputOpen(false)}
                className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!inputText.trim() || inputSaving}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inputSaving && <Loader2 size={12} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {bubble && (
        <div
          ref={bubbleRef}
          className="fixed z-50 w-72"
          style={{
            top: bubblePos?.top ?? -9999,
            left: bubblePos?.left ?? -9999,
          }}
        >
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <MessageSquare size={14} />
                Comments
              </span>
              <button
                type="button"
                onClick={() => setBubble(null)}
                className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-2 text-center text-sm text-gray-400">
                  No comments yet
                </p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-xl bg-gray-50 p-2.5"
                  >
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
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {comment.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
                placeholder="Reply…"
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={handleReply}
                disabled={!replyText.trim() || replySaving}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                title="Send reply"
              >
                {replySaving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
