import 'katex/dist/katex.min.css';
import { TOGGLE_COMMENT_INPUT_COMMAND, mockCommentsApi } from './comment';
import type { Comment, CommentAnchor } from './comment';
import { CommentPanel } from './comment/comment-panel';
import Editor from './editor';

export { Editor };
export default Editor;

export type { EditorProps } from './editor';

export type { EditorState, LexicalEditor } from 'lexical';

// Comment feature (non-destructive: anchor fused into each comment row,
// highlights rendered on the paint layer via CSS Custom Highlight API)
export { CommentPanel };
export { mockCommentsApi };
export { TOGGLE_COMMENT_INPUT_COMMAND };
export type { Comment, CommentAnchor };

// Mermaid 图表功能
export { MermaidNode } from './nodes/mermaid-node';
export {
  INSERT_MERMAID_COMMAND,
  MermaidExtension,
} from './plugins/mermaid-extension';
export type { SerializedMermaidNode } from './nodes/mermaid-node';

// 代码绘图功能
export { CodeDrawingNode } from './nodes/code-drawing-node';
export {
  INSERT_CODE_DRAWING_COMMAND,
  CodeDrawingExtension,
} from './plugins/code-drawing-extension';
export type {
  SerializedCodeDrawingNode,
  CodeDrawingType,
  CodeDrawingMode,
} from './nodes/code-drawing-node';

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
} from './nodes/drawio-node';
export {
  INSERT_DRAWIO_COMMAND,
  DrawioExtension,
} from './plugins/drawio-extension';
export type { DrawioElement } from './modals/drawio-modal';
export type { SerializedDrawioNode } from './nodes/drawio-node';

// 思维导图节点
export { MindNode, $createMindNode, $isMindNode } from './nodes/mind-node';
export { INSERT_MIND_COMMAND, MindExtension } from './plugins/mind-extension';
export type { MindElements } from './modals/mind-modal';
export type { SerializedMindNode } from './nodes/mind-node';

// 外部 iframe 嵌入服务配置（Draw.io / 思维导图）
export type { EmbedConfig, EmbedServiceConfig } from './embed';
export type { AttachmentProps } from './embed';
export { DEFAULT_DRAWIO_URL } from './embed';

// 文件附件节点
export {
  FileNode,
  $createFileNode,
  $isFileNode,
} from './nodes/file-node';
export type { FilePayload, SerializedFileNode } from './nodes/file-node';

// 轻量级编辑器（无工具栏/评论面板/目录等重型 UI）
export { LightEditor } from './light-editor';
export type { LightEditorProps } from './light-editor';

// 导出插入命令和类型（供 LightEditor 使用）
export {
  INSERT_AUDIO_COMMAND,
  INSERT_IMAGE_COMMAND,
  INSERT_VIDEO_COMMAND,
} from './editor';
export type {
  InsertAudioPayload,
  InsertImagePayload,
  InsertVideoPayload,
} from './commands';
