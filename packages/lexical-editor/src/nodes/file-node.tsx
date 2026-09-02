import {
  DecoratorNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import type { JSX } from 'react';
import { FileNodeComponent } from '../components';

export interface FilePayload {
  url: string;
  filename: string;
  size?: number;
  key?: NodeKey;
}

export type SerializedFileNode = Spread<
  {
    url: string;
    filename: string;
    size?: number;
  },
  SerializedLexicalNode
>;

export class FileNode extends DecoratorNode<JSX.Element> {
  __url: string;
  __filename: string;
  __size?: number;

  static getType(): string {
    return 'file';
  }

  static clone(node: FileNode): FileNode {
    return new FileNode(node.__url, node.__filename, node.__size, node.__key);
  }

  constructor(url: string, filename: string, size?: number, key?: NodeKey) {
    super(key);
    this.__url = url;
    this.__filename = filename;
    this.__size = size;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  updateDOM(): false {
    return false;
  }

  exportJSON(): SerializedFileNode {
    return {
      url: this.__url,
      filename: this.__filename,
      size: this.__size,
      type: 'file',
      version: 1,
    };
  }

  static importJSON(serialized: SerializedFileNode): FileNode {
    return $createFileNode({
      url: serialized.url,
      filename: serialized.filename,
      size: serialized.size,
    });
  }

  getUrl(): string {
    return this.__url;
  }

  setUrl(url: string): void {
    const writable = this.getWritable();
    writable.__url = url;
  }

  getFilename(): string {
    return this.__filename;
  }

  setFilename(filename: string): void {
    const writable = this.getWritable();
    writable.__filename = filename;
  }

  getSize(): number | undefined {
    return this.__size;
  }

  setSize(size: number): void {
    const writable = this.getWritable();
    writable.__size = size;
  }

  decorate(_editor: LexicalEditor): JSX.Element {
    return (
      <FileNodeComponent
        url={this.__url}
        filename={this.__filename}
        size={this.__size}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createFileNode(payload: FilePayload): FileNode {
  return new FileNode(payload.url, payload.filename, payload.size, payload.key);
}

export function $isFileNode(
  node: LexicalNode | null | undefined,
): node is FileNode {
  return node instanceof FileNode;
}
