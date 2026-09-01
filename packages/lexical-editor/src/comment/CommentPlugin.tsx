import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
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
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import {
  type TextIndex,
  buildTextIndex,
  createAnchorFromOffsets,
  createAnchorFromRange,
  offsetsToRange,
  pointToOffset,
  resolveAnchor,
} from './anchors';
import { TOGGLE_COMMENT_INPUT_COMMAND } from './commentCommands';
import { timeAgo } from './format';
import { mockCommentsApi, threadKeyOf } from './mockApi';
import type { Comment, CommentAnchor } from './types';
import './highlight.css';

/** Broadcast when the comment store changes so panels can refresh. */
export function notifyCommentsChanged(): void {
  window.dispatchEvent(new Event('leditor:comments-changed'));
}

/** 面板点击某条评论时，请求编辑器滚动定位并打开对应线程的气泡。 */
export const OPEN_COMMENT_THREAD_EVENT = 'leditor:open-comment-thread';

/** CSS Custom Highlight API 的高亮注册名（普通 / 激活线程） */
const HIGHLIGHT_ALL = 'leditor-comment';
const HIGHLIGHT_ACTIVE = 'leditor-comment-active';

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

/** 已解析为当前文档 Range 的评论线程 */
interface ResolvedThread {
  threadID: string;
  start: number;
  end: number;
  range: Range;
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
    top = fitsAbove ? anchor.top - gap - height : anchor.bottom + gap; // flip below when no room above
  } else {
    top = fitsBelow ? anchor.bottom + gap : anchor.top - gap - height; // flip above when no room below
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

/**
 * 把解析结果写入 CSS Custom Highlight API 的绘制层。
 * 高亮只存在于绘制层，不修改 DOM 结构，因此文档 JSON 保持不变。
 */
function applyHighlights(
  resolved: ResolvedThread[],
  activeThreadID: string | null,
): void {
  if (typeof Highlight === 'undefined' || !CSS.highlights) {
    return; // 浏览器不支持时静默降级：无高亮，但评论功能仍可用
  }
  const all = new Highlight();
  const active = new Highlight();
  for (const thread of resolved) {
    all.add(thread.range);
    if (thread.threadID === activeThreadID) {
      active.add(thread.range);
    }
  }
  CSS.highlights.set(HIGHLIGHT_ALL, all);
  CSS.highlights.set(HIGHLIGHT_ACTIVE, active);
}

/** 找到包含给定全文偏移的线程（重叠时取跨度最小的） */
function findThreadAt(
  resolved: ResolvedThread[],
  offset: number,
): ResolvedThread | null {
  let best: ResolvedThread | null = null;
  for (const thread of resolved) {
    if (offset >= thread.start && offset < thread.end) {
      if (!best || thread.end - thread.start < best.end - best.start) {
        best = thread;
      }
    }
  }
  return best;
}

/**
 * Comment UI: select text -> open the comment composer (from the toolbar),
 * save via the mock API. Comments are anchored outside the document, and
 * highlights are rendered purely on the paint layer (CSS Custom Highlight
 * API), so the document JSON is never modified. Clicking a highlighted range
 * shows the thread bubble where comments can be viewed, replied to or deleted.
 */
export function CommentPlugin() {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  /** 创建评论时捕获的选区 DOM Range（锚点在保存时才序列化） */
  const savedDomRange = useRef<Range | null>(null);
  /** 评论后端返回的各线程锚点（threadID -> anchor） */
  const anchorsRef = useRef<Record<string, CommentAnchor>>({});
  /** 当前文档下已解析的线程 Range */
  const resolvedRef = useRef<ResolvedThread[]>([]);
  /** 当前文档的全文文本索引 */
  const indexRef = useRef<TextIndex | null>(null);
  /** 当前激活（气泡打开中）的线程 */
  const activeThreadRef = useRef<string | null>(null);
  /** Thread whose comments were last loaded, so reopening doesn't re-fetch. */
  const loadedThreadRef = useRef<string | null>(null);

  /** 锚点变更后防抖持久化：攒一批线程的新 anchor，2s 后一次性写回后端 */
  const pendingAnchorUpdatesRef = useRef<Map<string, CommentAnchor>>(new Map());
  const flushAnchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [inputOpen, setInputOpen] = useState(false);
  const [inputPos, setInputPos] = useState<DOMRect | null>(null);
  const [inputText, setInputText] = useState('');
  const [inputSaving, setInputSaving] = useState(false);
  const [inputFinalPos, setInputFinalPos] = useState<Position | null>(null);
  const inputRef = useRef<HTMLDivElement | null>(null);

  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [bubblePos, setBubblePos] = useState<Position | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  const loadComments = useCallback(async (threadID: string) => {
    setLoading(true);
    try {
      const all = await mockCommentsApi.fetchComments();
      setComments(
        all
          .filter((c) => threadKeyOf(c) === threadID)
          .sort(
            (a, b) =>
              new Date(a.createAt).getTime() - new Date(b.createAt).getTime(),
          ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /** 把 pending 队列里的新锚点批量持久化到 mockApi（不触发 fetchThreadAnchors） */
  const flushAnchorUpdates = useCallback(() => {
    flushAnchorTimerRef.current = null;
    const pending = pendingAnchorUpdatesRef.current;
    if (pending.size === 0) return;
    pendingAnchorUpdatesRef.current = new Map();
    // 逐条异步持久化；Promise 独立飞行，不阻塞
    for (const [threadID, anchor] of pending) {
      mockCommentsApi.updateAnchor(threadID, anchor);
    }
  }, []);

  /** 入队一条锚点变更，重置 2s 防抖计时器 */
  const scheduleAnchorFlush = useCallback(() => {
    if (flushAnchorTimerRef.current) {
      clearTimeout(flushAnchorTimerRef.current);
    }
    flushAnchorTimerRef.current = setTimeout(flushAnchorUpdates, 2000);
  }, [flushAnchorUpdates]);

  /** 重建全文索引并把所有线程锚点解析为当前 Range，再刷新绘制层高亮。
   *  解析成功后，无论命中哪一层（Level 1/2/3），只要新偏移切出的文本 / prefix / suffix
   *  与原锚点不同，就用新文本重建锚点并回写到 anchorsRef + 防抖持久化到后端。
   *  这样 quote 被修改后，锚点会自动"追赶"到新文本；Level 3 虽然是上下文兜底定位，
   *  但新位置切出的 quote 是真实文本，值得回写。 */
  const recompute = useCallback(() => {
    const index = buildTextIndex(editor.getRootElement());
    indexRef.current = index;
    const resolved: ResolvedThread[] = [];
    for (const [threadID, oldAnchor] of Object.entries(anchorsRef.current)) {
      const offsets = resolveAnchor(index, oldAnchor);
      if (!offsets) {
        continue;
      }
      const range = offsetsToRange(index, offsets.start, offsets.end);
      if (range) {
        resolved.push({
          threadID,
          start: offsets.start,
          end: offsets.end,
          range,
        });
      }
      // 无论命中哪一层，都用新位置切出的真实文本重建锚点
      const rebuilt = createAnchorFromOffsets(
        index,
        offsets.start,
        offsets.end,
      );
      if (
        rebuilt.start !== oldAnchor.start ||
        rebuilt.end !== oldAnchor.end ||
        rebuilt.quote !== oldAnchor.quote ||
        rebuilt.prefix !== oldAnchor.prefix ||
        rebuilt.suffix !== oldAnchor.suffix
      ) {
        anchorsRef.current[threadID] = rebuilt;
        pendingAnchorUpdatesRef.current.set(threadID, rebuilt);
        scheduleAnchorFlush();
      }
    }
    resolvedRef.current = resolved;
    applyHighlights(resolved, activeThreadRef.current);
  }, [editor, scheduleAnchorFlush]);

  const openBubble = useCallback(
    (threadID: string, rect: AnchorRect) => {
      activeThreadRef.current = threadID;
      setBubble({ threadID, rect });
      // 每个线程只加载一次；回复/删除等操作会显式刷新
      if (threadID !== loadedThreadRef.current) {
        loadedThreadRef.current = threadID;
        loadComments(threadID);
      }
    },
    [loadComments],
  );

  const openInput = useCallback(() => {
    editor.getEditorState().read(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          return;
        }
        const domSelection = window.getSelection();
        if (!domSelection || domSelection.rangeCount === 0) {
          return;
        }
        savedDomRange.current = domSelection.getRangeAt(0).cloneRange();
        setInputPos(getSelectionRect());
        setInputOpen(true);
      },
      { editor },
    );
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

  // 首次挂载以及评论存储变化时，重新拉取评论（锚点融合在每条评论中）
  // 并按线程提取锚点重绘高亮
  useEffect(() => {
    let cancelled = false;
    const fetchThreadAnchors = async () => {
      // **竞态修复**：在从后端重载锚点前，先把防抖队列里尚未持久化的
      // 锚点更新 flush 到 localStorage，否则 fetch 回来的是旧锚点，
      // 会覆盖 anchorsRef.current 里已经追赶到位的新锚点。
      flushAnchorUpdates();

      const all = await mockCommentsApi.fetchComments();
      if (cancelled) {
        return;
      }
      const anchors: Record<string, CommentAnchor> = {};
      for (const comment of all) {
        const key = threadKeyOf(comment);
        if (comment.position && !anchors[key]) {
          anchors[key] = comment.position;
        }
      }
      anchorsRef.current = anchors;
      recompute();
    };
    fetchThreadAnchors();
    window.addEventListener('leditor:comments-changed', fetchThreadAnchors);
    return () => {
      cancelled = true;
      window.removeEventListener(
        'leditor:comments-changed',
        fetchThreadAnchors,
      );
    };
  }, [recompute, flushAnchorUpdates]);

  // 编辑器每次更新后（rAF 节流）重建索引并重新解析锚点，
  // Range 是活的，会跟随 DOM 移动，因此无需监听滚动/缩放。
  useEffect(() => {
    let frame = 0;
    const unregister = editor.registerUpdateListener(() => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    });
    return () => {
      unregister();
      if (frame) {
        cancelAnimationFrame(frame);
      }
    };
  }, [editor, recompute]);

  // 组件卸载时：取消防抖计时器并立即 flush 剩余锚点变更，防止丢失
  useEffect(() => {
    return () => {
      if (flushAnchorTimerRef.current) {
        clearTimeout(flushAnchorTimerRef.current);
        flushAnchorTimerRef.current = null;
      }
      flushAnchorUpdates();
    };
  }, [flushAnchorUpdates]);

  // 气泡切换线程时更新激活高亮
  useEffect(() => {
    activeThreadRef.current = bubble?.threadID ?? null;
    applyHighlights(resolvedRef.current, activeThreadRef.current);
  }, [bubble]);

  // 点击命中检测：把点击坐标换算为全文偏移，落在某线程范围内则打开其气泡，
  // 点击文档空白处则关闭气泡（高亮层不接收事件，故在根元素上统一处理）。
  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      const index = indexRef.current;
      if (!index) {
        return;
      }
      const offset = pointToOffset(index, event.clientX, event.clientY);
      const hit =
        offset === null ? null : findThreadAt(resolvedRef.current, offset);
      if (hit) {
        const rect = hit.range.getBoundingClientRect();
        openBubble(hit.threadID, {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
        });
      } else {
        setBubble((prev) => (prev ? null : prev));
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [editor, openBubble]);

  // 评论面板跳转：滚动到线程位置并打开气泡
  useEffect(() => {
    const onOpenThread = (event: Event) => {
      const threadID = (event as CustomEvent<{ threadID: string }>).detail
        ?.threadID;
      if (!threadID) {
        return;
      }
      const hit = resolvedRef.current.find((r) => r.threadID === threadID);
      if (!hit) {
        return;
      }
      const anchorEl =
        hit.range.startContainer.parentElement ??
        hit.range.commonAncestorContainer.parentElement;
      anchorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = hit.range.getBoundingClientRect();
      openBubble(threadID, {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
      });
    };
    window.addEventListener(OPEN_COMMENT_THREAD_EVENT, onOpenThread);
    return () =>
      window.removeEventListener(OPEN_COMMENT_THREAD_EVENT, onOpenThread);
  }, [openBubble]);

  const handleAddComment = async () => {
    const text = inputText.trim();
    if (!text || !savedDomRange.current || inputSaving) {
      return;
    }
    setInputSaving(true);
    try {
      // 保存时用最新 DOM 重建索引，保证锚点偏移与当前文档一致；
      // 全程不调用 editor.update，文档 JSON 保持不变。
      const index = buildTextIndex(editor.getRootElement());
      const anchor = createAnchorFromRange(index, savedDomRange.current);
      if (!anchor) {
        return;
      }
      const comment = await mockCommentsApi.createComment({
        content: text,
        position: anchor,
      });
      // 乐观更新本地锚点并立即重绘高亮，随后广播让面板刷新
      const threadID = threadKeyOf(comment);
      anchorsRef.current = { ...anchorsRef.current, [threadID]: anchor };
      recompute();
      setInputOpen(false);
      setInputText('');
      savedDomRange.current = null;
      if (inputPos) {
        openBubble(threadID, {
          top: inputPos.top,
          left: inputPos.left,
          bottom: inputPos.bottom,
        });
      }
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
      // 回复继承线程锚点（后台 createComment 自动写入 contentExtra）
      await mockCommentsApi.createComment({
        content: text,
        parentId: bubble.threadID,
      });
      setReplyText('');
      await loadComments(bubble.threadID);
      notifyCommentsChanged();
    } finally {
      setReplySaving(false);
    }
  };

  const handleDelete = async (comment: Comment) => {
    await mockCommentsApi.deleteComment(comment.commentId);
    const key = threadKeyOf(comment);
    const remaining = (await mockCommentsApi.fetchComments()).filter(
      (c) => threadKeyOf(c) === key,
    );
    if (remaining.length === 0) {
      // 线程清空：锚点随评论一起删除（融合在评论中），无需额外清理
      delete anchorsRef.current[key];
      recompute();
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
                {t(locale, 'addComment')}
              </span>
              <button
                type="button"
                onClick={() => setInputOpen(false)}
                className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title={t(locale, 'cancel')}
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t(locale, 'writeCommentPlaceholder')}
              rows={3}
              autoFocus
              className="w-full resize-none rounded-lg border border-gray-200 p-2 text-sm outline-none"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInputOpen(false)}
                className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                {t(locale, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={!inputText.trim() || inputSaving}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inputSaving && <Loader2 size={12} className="animate-spin" />}
                {t(locale, 'save')}
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
                {t(locale, 'comments')}
              </span>
              <button
                type="button"
                onClick={() => setBubble(null)}
                className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title={t(locale, 'close')}
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
                  {t(locale, 'noComments')}
                </p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.commentId}
                    className="rounded-xl bg-gray-50 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        {comment.nickname || comment.account}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">
                          {timeAgo(comment.createAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(comment)}
                          className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                          title={t(locale, 'deleteComment')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {comment.content}
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
                title={t(locale, 'sendReply')}
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
