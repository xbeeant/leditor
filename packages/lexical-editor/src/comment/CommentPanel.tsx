import { Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import { OPEN_COMMENT_THREAD_EVENT } from './CommentPlugin';
import { timeAgo } from './format';
import { mockCommentsApi, threadKeyOf } from './mockApi';
import type { Comment } from './types';

interface PanelThread {
  /** 线程键（根评论ID） */
  threadID: string;
  /** 该线程锚定的原文（取自评论中融合的锚点，不依赖文档结构） */
  quote: string;
  comments: Comment[];
}

function latestTime(comments: Comment[]): number {
  return comments.reduce(
    (max, c) => Math.max(max, new Date(c.createAt).getTime()),
    0,
  );
}

/**
 * Right-hand comment list panel, styled like the pinned table of contents.
 * Shows every comment thread in the document; clicking a thread scrolls to
 * the anchored range (resolved by CommentPlugin) and opens its bubble.
 * 面板数据全部来自评论后端：线程按根评论ID分组，锚点融合在每条评论中。
 */
export function CommentPanel() {
  const locale = useLocale();
  const [threads, setThreads] = useState<PanelThread[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const refreshTokenRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!mounted.current) {
      return;
    }
    const token = ++refreshTokenRef.current;
    // Only show the full-height spinner on the first load; background
    // refreshes (e.g. adding a reply) must not flicker.
    if (!loadedOnceRef.current) {
      setLoading(true);
    }
    try {
      const all = await mockCommentsApi.fetchComments();
      if (!mounted.current || token !== refreshTokenRef.current) {
        return;
      }
      const grouped: Record<string, Comment[]> = {};
      for (const comment of all) {
        const key = threadKeyOf(comment);
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(comment);
      }
      const list: PanelThread[] = Object.entries(grouped).map(
        ([threadID, comments]) => ({
          threadID,
          comments: comments.sort(
            (a, b) =>
              new Date(a.createAt).getTime() - new Date(b.createAt).getTime(),
          ),
          // 引用原文优先取线程内顶层评论的锚点，其次取任意一条携带的锚点
          quote:
            comments.find((c) => c.commentId === threadID)?.position?.quote ??
            comments.find((c) => c.position)?.position?.quote ??
            '',
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
  }, []);

  // Refresh when the comment store changes (add / reply / delete anywhere)
  useEffect(() => {
    mounted.current = true;
    refresh();
    const onStoreChange = () => refresh();
    window.addEventListener('leditor:comments-changed', onStoreChange);
    return () => {
      mounted.current = false;
      window.removeEventListener('leditor:comments-changed', onStoreChange);
    };
  }, [refresh]);

  // 跳转由 CommentPlugin 解析锚点并滚动定位（避免在面板里重复维护全文索引）
  const handleJump = (thread: PanelThread) => {
    window.dispatchEvent(
      new CustomEvent(OPEN_COMMENT_THREAD_EVENT, {
        detail: { threadID: thread.threadID },
      }),
    );
  };

  const handleDelete = async (comment: Comment) => {
    await mockCommentsApi.deleteComment(comment.commentId);
    // 线程清空时锚点随评论一起删除（融合在评论中），无需额外清理
    await refresh();
  };

  // 没有评论时(含首次加载中)不渲染面板,避免空面板闪现;
  // 一旦加载出评论或后续新增评论,面板自动显示。
  if (threads.length === 0) {
    return null;
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50/50">
      <div className="flex items-center gap-1.5 px-5 pt-5 pb-2">
        <MessageSquare size={14} className="text-gray-700" />
        <span className="text-sm font-medium text-gray-900">
          {t(locale, 'comments')}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-2 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm leading-relaxed text-gray-400">
            {t(locale, 'commentsEmptyHint')}
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
                title={
                  thread.quote
                    ? `"${thread.quote}"`
                    : t(locale, 'highlightedText')
                }
              >
                &ldquo;{thread.quote || t(locale, 'highlightedText')}&rdquo;
              </button>
              <div className="mt-2 space-y-2">
                {thread.comments.map((comment) => (
                  <div
                    key={comment.commentId}
                    className="rounded-lg bg-gray-50 p-2"
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
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">
                      {comment.content}
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
