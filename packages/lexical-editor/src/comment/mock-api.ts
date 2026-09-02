import type { Comment, CommentAnchor } from './types';

const STORAGE_KEY = 'leditor-comments-mock';

const DEFAULT_ACCOUNT = 'alice';
const DEFAULT_NICKNAME = 'Alice';
const DEFAULT_CREATOR = '10001';

function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 模拟 bigint 主键：毫秒时间戳 + 3 位随机数（16 位数字，不溢出 bigint） */
function generateCommentId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

/** content_extra 列的 JSON 结构（锚点 position 与未来的扩展字段） */
interface ExtraBlob {
  position?: CommentAnchor;
  [key: string]: unknown;
}

function parseExtra(raw: string | undefined): ExtraBlob {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as ExtraBlob) : {};
  } catch {
    return {};
  }
}

function serializeExtra(extra: ExtraBlob): string {
  return JSON.stringify(extra);
}

/**
 * 线程键（即根评论ID）：回复归属的顶层评论；顶层评论的线程键是其自身
 * commentId。相当于后台按 root_id / parent_id 组织线程。
 */
export function threadKeyOf(comment: Comment): string {
  if (comment.rootId) {
    return comment.rootId;
  }
  if (comment.parentId && comment.parentId !== '0') {
    return comment.parentId;
  }
  return comment.commentId;
}

/** 旧版 mock 数据行（CommentData：threadID/text/author），用于迁移 */
interface LegacyCommentData {
  id: string;
  threadID: string;
  author?: string;
  text?: string;
  createdAt?: string;
}

function isLegacyRow(row: unknown): row is LegacyCommentData {
  return (
    !!row &&
    typeof row === 'object' &&
    'threadID' in row &&
    !('commentId' in row)
  );
}

function migrateLegacyRow(
  row: LegacyCommentData,
  oldAnchors: Record<string, CommentAnchor>,
): Comment {
  const position = oldAnchors[row.threadID];
  return {
    commentId: row.id,
    rootId: row.threadID,
    content: row.text ?? '',
    contentExtra: position ? serializeExtra({ position }) : '',
    position,
    account: (row.author ?? DEFAULT_ACCOUNT).toLowerCase(),
    nickname: row.author ?? DEFAULT_NICKNAME,
    creator: DEFAULT_CREATOR,
    star: 0,
    dislike: 0,
    createAt: row.createdAt ?? new Date().toISOString(),
  };
}

function loadStore(): Comment[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    // v2 存储格式为 { comments, anchors }，v1 为纯 CommentData 数组
    let rows: unknown[] = [];
    let oldAnchors: Record<string, CommentAnchor> = {};
    if (Array.isArray(parsed)) {
      rows = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const blob = parsed as {
        comments?: unknown[];
        anchors?: Record<string, CommentAnchor>;
      };
      rows = Array.isArray(blob.comments) ? blob.comments : [];
      oldAnchors = blob.anchors ?? {};
    }
    // 旧版行迁移为 DDL 结构：锚点融合进每条评论的 contentExtra
    if (rows.some(isLegacyRow)) {
      return rows.map((row) =>
        isLegacyRow(row) ? migrateLegacyRow(row, oldAnchors) : (row as Comment),
      );
    }
    return rows as Comment[];
  } catch {
    return [];
  }
}

function persist(rows: Comment[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota / privacy errors in the mock
  }
}

export interface CreateCommentInput {
  /** 评论内容 */
  content: string;
  /** 回复目标：根评论ID；缺省则创建顶层评论 */
  parentId?: string;
  /** 锚点：顶层评论创建时传入；回复时自动继承根评论的锚点 */
  position?: CommentAnchor;
  account?: string;
  nickname?: string;
  creator?: string;
  /** 资源ID（如文档ID） */
  rid?: string;
  /** 接入应用ID */
  appid?: string;
}

export interface MockCommentsApi {
  /** Fetch all comment rows (position parsed from contentExtra). */
  fetchComments(): Promise<Comment[]>;
  /** Save a new comment (top-level or reply) and return the stored row. */
  createComment(input: CreateCommentInput): Promise<Comment>;
  /** Delete a comment row by id. */
  deleteComment(commentId: string): Promise<void>;
  /** Wipe all stored comments (useful for demos). */
  clearComments(): Promise<void>;
  /**
   * 更新某线程（root comment / threadID）的锚点信息。
   * 文本编辑后由编辑器内部调用：把新 start/end/quote/prefix/suffix
   * 回写到 localStorage，所有属于该线程的评论（含回复）都会同步更新。
   * 纯后端操作，不派发 leditor:comments-changed 以避免前端重新拉取。
   */
  updateAnchor(threadID: string, anchor: CommentAnchor): Promise<void>;
}

/**
 * Mock backend for the comment feature, shaped like the `comment` table DDL.
 * 锚点不单独存储：顶层评论创建时写入自身 contentExtra，回复继承根评论的
 * 锚点，即每条评论都携带线程锚点；fetch 时从 contentExtra 解析出 position。
 */
export const mockCommentsApi: MockCommentsApi = {
  async fetchComments(): Promise<Comment[]> {
    await delay();
    return loadStore().map((row) => ({
      ...row,
      position: parseExtra(row.contentExtra).position,
    }));
  },

  async createComment(input: CreateCommentInput): Promise<Comment> {
    await delay();
    const store = loadStore();
    // 回复时定位根评论（parentId 为根评论ID）
    const root = input.parentId
      ? store.find((c) => c.commentId === input.parentId)
      : undefined;
    // 锚点融合：顶层评论写入传入锚点；回复继承根评论锚点
    const position =
      input.position ??
      (root ? parseExtra(root.contentExtra).position : undefined);
    const comment: Comment = {
      commentId: generateCommentId(),
      parentId: root ? root.commentId : '0',
      rootId: root ? (root.rootId ?? root.commentId) : undefined,
      content: input.content,
      contentExtra: position ? serializeExtra({ position }) : '',
      position,
      account: input.account ?? DEFAULT_ACCOUNT,
      nickname: input.nickname ?? DEFAULT_NICKNAME,
      creator: input.creator ?? DEFAULT_CREATOR,
      star: 0,
      dislike: 0,
      createAt: new Date().toISOString(),
      replyAccount: root?.account,
      replyNickname: root?.nickname,
      rid: input.rid,
      appid: input.appid,
    };
    store.push(comment);
    persist(store);
    return comment;
  },

  async deleteComment(commentId: string): Promise<void> {
    await delay();
    persist(loadStore().filter((c) => c.commentId !== commentId));
  },

  async clearComments(): Promise<void> {
    await delay();
    persist([]);
  },

  async updateAnchor(threadID: string, anchor: CommentAnchor): Promise<void> {
    await delay(0); // 同步 localStorage，但保持 Promise 形态
    const store = loadStore();
    const updated = store.map((c) => {
      // threadKeyOf 里 rootId 优先 → parentId → commentId
      const key = c.rootId ?? c.parentId ?? c.commentId;
      if (key !== threadID) return c;
      const extra = parseExtra(c.contentExtra);
      return {
        ...c,
        contentExtra: serializeExtra({ ...extra, position: anchor }),
        position: anchor,
      };
    });
    persist(updated);
  },
};
