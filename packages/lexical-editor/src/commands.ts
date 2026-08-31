import { $createTableCellNode, TableNode, TableRowNode } from '@lexical/table';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import { createCommand } from 'lexical';

export interface InsertImagePayload {
  altText: string;
  src: string;
  width?: string;
  height?: string;
}

export const INSERT_IMAGE_COMMAND = createCommand<InsertImagePayload>(
  'INSERT_IMAGE_COMMAND',
);

export interface InsertVideoPayload {
  src: string;
  width?: string;
  height?: string;
}

export const INSERT_VIDEO_COMMAND = createCommand<InsertVideoPayload>(
  'INSERT_VIDEO_COMMAND',
);

export interface InsertAudioPayload {
  src: string;
}

export const INSERT_AUDIO_COMMAND = createCommand<InsertAudioPayload>(
  'INSERT_AUDIO_COMMAND',
);

export interface InsertEquationPayload {
  equation: string;
  inline: boolean;
}

export const INSERT_EQUATION_COMMAND = createCommand<InsertEquationPayload>(
  'INSERT_EQUATION_COMMAND',
);

/**
 * Insert a node immediately after the current top-level block.
 * When the selection is inside a code block, the node is added after the
 * code block (so a paragraph is created outside of it, not inside).
 */
export function insertBlockAfter(
  editor: LexicalEditor,
  createNode: () => LexicalNode,
): void {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchorNode = selection.anchor.getNode();
    const node = createNode();

    if (anchorNode.getKey() === 'root') {
      (anchorNode as unknown as ElementNode).append(node);
    } else {
      const topLevel = anchorNode.getTopLevelElementOrThrow();
      topLevel.insertAfter(node);
    }

    const selectable = node as unknown as { selectStart?: () => void };
    if (typeof selectable.selectStart === 'function') {
      selectable.selectStart();
    }
  });
}

export function insertParagraphAfter(editor: LexicalEditor): void {
  insertBlockAfter(editor, () => $createParagraphNode());
}

/**
 * Insert a node after the current top-level block, then append an empty
 * paragraph after it and move the cursor into that paragraph. This keeps the
 * user able to type right away after block-level content that has no caret
 * position of its own, such as a display (non-inline) equation.
 */
export function insertBlockWithParagraphAfter(
  editor: LexicalEditor,
  createNode: () => LexicalNode,
): void {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchorNode = selection.anchor.getNode();
    const node = createNode();
    const paragraph = $createParagraphNode();

    if (anchorNode.getKey() === 'root') {
      (anchorNode as unknown as ElementNode).append(node);
    } else {
      const topLevel = anchorNode.getTopLevelElementOrThrow();
      topLevel.insertAfter(node);
    }

    node.insertAfter(paragraph);
    paragraph.select();
  });
}

export function $createTable(columns: number, rows: number): TableNode {
  const table = new TableNode();
  for (let r = 0; r < rows; r += 1) {
    const row = new TableRowNode();
    for (let c = 0; c < columns; c += 1) {
      const cell = $createTableCellNode();
      cell.append($createParagraphNode());
      row.append(cell);
    }
    table.append(row);
  }
  return table;
}
