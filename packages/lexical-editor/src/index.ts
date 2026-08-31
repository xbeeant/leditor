import 'katex/dist/katex.min.css';
import './checklist.css';
import './equation.css';
import './table-scroll-shadow.css';
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

// Mermaid 图表功能
export { MermaidNode } from './MermaidNode';
export {
  INSERT_MERMAID_COMMAND,
  MermaidPlugin,
} from './MermaidPlugin';
export type { SerializedMermaidNode } from './MermaidNode';

// 代码绘图功能
export { CodeDrawingNode } from './CodeDrawingNode';
export {
  INSERT_CODE_DRAWING_COMMAND,
  CodeDrawingPlugin,
} from './CodeDrawingPlugin';
export type {
  SerializedCodeDrawingNode,
  CodeDrawingType,
  CodeDrawingMode,
} from './CodeDrawingNode';

// DOCX 导出功能
export {
  exportLexicalToDocx,
  exportLexicalValueToDocx,
  combineLexicalValues,
  deepCleanControlChars,
} from './docx';
export type { ExportOptions } from './docx';

// 差异对比编辑器
export { DiffEditor } from './diff/DiffEditor';
export { computeDiffState } from './diff/compute-diff-state';
