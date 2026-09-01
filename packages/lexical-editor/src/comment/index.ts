export {
  CommentPlugin,
  notifyCommentsChanged,
  OPEN_COMMENT_THREAD_EVENT,
} from './CommentPlugin';
export { TOGGLE_COMMENT_INPUT_COMMAND } from './commentCommands';
export { mockCommentsApi, threadKeyOf } from './mockApi';
export type { Comment, CommentAnchor } from './types';
