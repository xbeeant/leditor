import 'katex/dist/katex.min.css';
import './checklist.css';
import './equation.css';
import Editor from './Editor';
import {
  TOGGLE_COMMENT_INPUT_COMMAND,
  UNWRAP_MARK_COMMAND,
  WRAP_SELECTION_IN_MARK_COMMAND,
  mockCommentsApi,
} from './comment';
import type { CommentData, CommentThread } from './comment';
import { CommentPanel } from './comment/CommentPanel';

export { Editor };
export default Editor;

export type { EditorProps } from './Editor';

export type { EditorState, LexicalEditor } from 'lexical';

// Comment feature (mock API: fetch / save / delete)
export { CommentPanel };
export { mockCommentsApi };
export {
  TOGGLE_COMMENT_INPUT_COMMAND,
  WRAP_SELECTION_IN_MARK_COMMAND,
  UNWRAP_MARK_COMMAND,
};
export type { CommentData, CommentThread };
