import { InsertMenu } from './InsertMenu';
import type { InsertBlockType } from './types';

interface InsertGroupProps {
  onInsert: (type: InsertBlockType) => void;
  onInsertTable: (rows: number, cols: number) => void;
}

export function InsertGroup({ onInsert, onInsertTable }: InsertGroupProps) {
  return <InsertMenu onInsert={onInsert} onInsertTable={onInsertTable} />;
}
