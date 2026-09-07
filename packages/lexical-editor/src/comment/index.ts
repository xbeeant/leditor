export {
  CommentPlugin,
  notifyCommentsChanged,
  OPEN_COMMENT_THREAD_EVENT,
} from './comment-plugin';
export { TOGGLE_COMMENT_INPUT_COMMAND } from './comment-commands';
export { mockCommentsApi, threadKeyOf } from './mock-api';
export type { Comment, CommentAnchor } from './types';
