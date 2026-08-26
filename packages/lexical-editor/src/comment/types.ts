/** A single comment attached to a highlighted text range. */
export interface CommentData {
  id: string;
  /** Groups comments sharing the same highlighted range. */
  threadID: string;
  author: string;
  text: string;
  createdAt: string;
}

/** A comment thread (the comments attached to one highlighted range). */
export interface CommentThread {
  threadID: string;
  comments: CommentData[];
}
