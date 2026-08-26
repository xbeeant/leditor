import type { CommentData } from './types';

const STORAGE_KEY = 'leditor-comments-mock';

const DEFAULT_AUTHOR = 'Alice';

function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadStore(): CommentData[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CommentData[]) : [];
  } catch {
    return [];
  }
}

function persist(store: CommentData[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / privacy errors in the mock
  }
}

export interface CreateCommentInput {
  threadID: string;
  text: string;
  author?: string;
}

export interface MockCommentsApi {
  /** Fetch all comments, optionally filtered by thread. */
  fetchComments(threadID?: string): Promise<CommentData[]>;
  /** Save a new comment. */
  createComment(input: CreateCommentInput): Promise<CommentData>;
  /** Delete a comment by id. */
  deleteComment(id: string): Promise<void>;
  /** Wipe all stored comments (useful for demos). */
  clearComments(): Promise<void>;
}

/**
 * Mock backend for the comment feature: fetch / save / delete are simulated
 * with a localStorage-backed store and a fake network latency.
 */
export const mockCommentsApi: MockCommentsApi = {
  async fetchComments(threadID?: string): Promise<CommentData[]> {
    await delay();
    const store = loadStore();
    return threadID ? store.filter((c) => c.threadID === threadID) : store;
  },

  async createComment({ threadID, text, author }): Promise<CommentData> {
    await delay();
    const comment: CommentData = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      threadID,
      author: author || DEFAULT_AUTHOR,
      text,
      createdAt: new Date().toISOString(),
    };
    const store = loadStore();
    store.push(comment);
    persist(store);
    return comment;
  },

  async deleteComment(id: string): Promise<void> {
    await delay();
    persist(loadStore().filter((c) => c.id !== id));
  },

  async clearComments(): Promise<void> {
    await delay();
    persist([]);
  },
};
