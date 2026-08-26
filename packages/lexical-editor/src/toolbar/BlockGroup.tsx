import { ToolbarDropdown } from './ToolbarDropdown';
import { CODE_LANGUAGES } from './constants';
import type { BlockType } from './types';

const BLOCK_OPTIONS = [
  { value: 'paragraph', label: 'Normal' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'quote', label: 'Quote' },
  { value: 'code', label: 'Code block' },
  { value: 'bullet', label: 'Bulleted list' },
  { value: 'number', label: 'Numbered list' },
  { value: 'check', label: 'Check list' },
];

interface BlockGroupProps {
  blockType: BlockType;
  onBlockTypeChange: (value: BlockType) => void;
  codeLanguage: string;
  onCodeLanguageChange: (language: string) => void;
}

export function BlockGroup({
  blockType,
  onBlockTypeChange,
  codeLanguage,
  onCodeLanguageChange,
}: BlockGroupProps) {
  return (
    <>
      <ToolbarDropdown
        label="Paragraph style"
        value={blockType}
        options={BLOCK_OPTIONS}
        onChange={(v) => onBlockTypeChange(v as BlockType)}
        className="min-w-30"
      />
      {blockType === 'code' && (
        <ToolbarDropdown
          label="Code language"
          value={codeLanguage}
          options={CODE_LANGUAGES.map((l) => ({ value: l, label: l }))}
          onChange={onCodeLanguageChange}
          className="w-32"
        />
      )}
    </>
  );
}
