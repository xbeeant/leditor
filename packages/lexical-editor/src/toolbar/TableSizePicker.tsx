import { X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../i18n';
import { useLocale } from '../LocaleContext';

export const MAX_TABLE_COLS = 10;
export const MAX_TABLE_ROWS = 8;

interface TableSizePickerProps {
  onSelect: (rows: number, cols: number) => void;
  onCancel: () => void;
}

/**
 * Grid picker shown when inserting a table: move the pointer to "paint"
 * the desired number of rows × columns, then click to insert.
 */
export function TableSizePicker({ onSelect, onCancel }: TableSizePickerProps) {
  const [size, setSize] = useState({ rows: 0, cols: 0 });
  const locale = useLocale();

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">
          {size.rows > 0
            ? `${size.rows} × ${size.cols}`
            : 'Select table size'}
        </span>
        <button
          type="button"
          aria-label={t(locale, 'cancel')}
          title={t(locale, 'cancel')}
          onClick={onCancel}
          className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${MAX_TABLE_COLS}, 18px)` }}
      >
        {Array.from({ length: MAX_TABLE_ROWS * MAX_TABLE_COLS }).map(
          (_, index) => {
            const row = Math.floor(index / MAX_TABLE_COLS) + 1;
            const col = (index % MAX_TABLE_COLS) + 1;
            const active =
              size.rows > 0 && row <= size.rows && col <= size.cols;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                aria-label={`${row} rows, ${col} columns`}
                className={`h-[18px] w-[18px] rounded-[3px] border transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300 bg-white hover:border-blue-400'
                }`}
                onMouseEnter={() => setSize({ rows: row, cols: col })}
                onClick={() =>
                  onSelect(
                    size.rows > 0 ? size.rows : row,
                    size.cols > 0 ? size.cols : col,
                  )
                }
              />
            );
          },
        )}
      </div>
    </div>
  );
}
