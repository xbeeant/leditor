import {
  Bold,
  Code,
  Italic,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import type { TextFormat } from './types';

interface TextFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  subscript: boolean;
  superscript: boolean;
  code: boolean;
}

interface TextFormatGroupProps {
  formats: TextFormatState;
  onFormat: (format: TextFormat) => void;
}

export function TextFormatGroup({ formats, onFormat }: TextFormatGroupProps) {
  return (
    <>
      <ToolbarButton
        title="Bold"
        active={formats.bold}
        onClick={() => onFormat('bold')}
      >
        <Bold size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={formats.italic}
        onClick={() => onFormat('italic')}
      >
        <Italic size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Underline"
        active={formats.underline}
        onClick={() => onFormat('underline')}
      >
        <Underline size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={formats.strikethrough}
        onClick={() => onFormat('strikethrough')}
      >
        <Strikethrough size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Subscript"
        active={formats.subscript}
        onClick={() => onFormat('subscript')}
      >
        <Subscript size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Superscript"
        active={formats.superscript}
        onClick={() => onFormat('superscript')}
      >
        <Superscript size={18} />
      </ToolbarButton>
      <ToolbarButton
        title="Inline code"
        active={formats.code}
        onClick={() => onFormat('code')}
      >
        <Code size={18} />
      </ToolbarButton>
    </>
  );
}
