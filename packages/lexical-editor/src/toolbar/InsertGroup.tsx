import { InsertMenu } from './InsertMenu';
import type { InsertBlockType } from './types';

interface InsertGroupProps {
  onInsert: (type: InsertBlockType) => void;
}

export function InsertGroup({ onInsert }: InsertGroupProps) {
  return <InsertMenu onInsert={onInsert} />;
}
