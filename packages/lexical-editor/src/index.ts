import 'katex/dist/katex.min.css';
import Editor from './Editor';
import {
  TOGGLE_COMMENT_INPUT_COMMAND,
  mockCommentsApi,
} from './comment';
import type { Comment, CommentAnchor } from './comment';
import { CommentPanel } from './comment/CommentPanel';

export { Editor };
export default Editor;

export type { EditorProps } from './Editor';

export type { EditorState, LexicalEditor } from 'lexical';

// Comment feature (non-destructive: anchor fused into each comment row,
// highlights rendered on the paint layer via CSS Custom Highlight API)
export { CommentPanel };
export { mockCommentsApi };
export { TOGGLE_COMMENT_INPUT_COMMAND };
export type { Comment, CommentAnchor };

// Mermaid 图表功能
export { MermaidNode } from './nodes/MermaidNode';
export {
  INSERT_MERMAID_COMMAND,
  MermaidPlugin,
} from './plugins/MermaidPlugin';
export type { SerializedMermaidNode } from './nodes/MermaidNode';

// 代码绘图功能
export { CodeDrawingNode } from './nodes/CodeDrawingNode';
export {
  INSERT_CODE_DRAWING_COMMAND,
  CodeDrawingPlugin,
} from './plugins/CodeDrawingPlugin';
export type {
  SerializedCodeDrawingNode,
  CodeDrawingType,
  CodeDrawingMode,
} from './nodes/CodeDrawingNode';

// DOCX 导出功能
export {
  exportLexicalToDocx,
  exportLexicalValueToDocx,
  combineLexicalValues,
  deepCleanControlChars,
} from './docx';
export type { ExportOptions } from './docx';

// 差异对比编辑器
export { DiffEditor } from './diff';
export { computeDiffState } from './diff';

// Draw.io 图表节点
export {
  DrawioNode,
  $createDrawioNode,
  $isDrawioNode,
} from './nodes/DrawioNode';
export {
  INSERT_DRAWIO_COMMAND,
  DrawioPlugin,
} from './plugins/DrawioPlugin';
export type { DrawioElement } from './modals/DrawioModal';
export type { SerializedDrawioNode } from './nodes/DrawioNode';

// 思维导图节点
export { MindNode, $createMindNode, $isMindNode } from './nodes/MindNode';
export { INSERT_MIND_COMMAND, MindPlugin } from './plugins/MindPlugin';
export type { MindElements } from './modals/MindModal';
export type { SerializedMindNode } from './nodes/MindNode';

// 外部 iframe 嵌入服务配置（Draw.io / 思维导图）
export type { EmbedConfig, EmbedServiceConfig } from './embed';
export type { AttachmentProps } from './embed';
export { DEFAULT_DRAWIO_URL } from './embed';

// 文件附件节点
export {
  FileNode,
  $createFileNode,
  $isFileNode,
} from './nodes/FileNode';
export type { FilePayload, SerializedFileNode } from './nodes/FileNode';
