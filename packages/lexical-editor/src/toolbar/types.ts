export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bullet'
  | 'number'
  | 'check'
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
  | 'quote'
  | 'code'
  | 'bullet'
  | 'number'
  | 'check'
  | 'table'
  | 'divider'
  | 'image';
