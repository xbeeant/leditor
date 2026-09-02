export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bullet'
  | 'number'
  | 'check'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman'
  | 'quote'
  | 'code';

export type TextFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'subscript'
  | 'superscript'
  | 'code';

export type AlignType = 'left' | 'center' | 'right' | 'justify';

export type InsertBlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'code'
  | 'bullet'
  | 'number'
  | 'check'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman'
  | 'table'
  | 'divider'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'equation'
  | 'inlineEquation'
  | 'mermaid'
  | 'callout'
  | 'codeDrawing'
  | 'drawio'
  | 'mind'
  | 'outline'
  | 'umlDiagram'
  | 'projectCard'
  | 'projectList';

/** 独立列表插入按钮支持的格式 */
export type ListFormatType =
  | 'number'
  | 'lower-alpha'
  | 'upper-alpha'
  | 'lower-roman'
  | 'upper-roman';

/** 无序列表标记样式 */
export type BulletStyleType = 'disc' | 'circle' | 'square';
