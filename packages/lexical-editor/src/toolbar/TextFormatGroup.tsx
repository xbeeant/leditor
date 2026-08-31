import {
  Bold,
  Code,
  Italic,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react';
import { memo } from 'react';
import { t } from '../i18n';
import { useLocale } from '../LocaleContext';
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

export const TextFormatGroup = memo(function TextFormatGroup({
  formats,
  onFormat,
}: TextFormatGroupProps) {
  const locale = useLocale();
  return (
    <>
      <ToolbarButton
        title={t(locale, 'bold')}
        active={formats.bold}
        onClick={() => onFormat('bold')}
      >
        <Bold size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'italic')}
        active={formats.italic}
        onClick={() => onFormat('italic')}
      >
        <Italic size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'underline')}
        active={formats.underline}
        onClick={() => onFormat('underline')}
      >
        <Underline size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'strikethrough')}
        active={formats.strikethrough}
        onClick={() => onFormat('strikethrough')}
      >
        <Strikethrough size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'subscript')}
        active={formats.subscript}
        onClick={() => onFormat('subscript')}
      >
        <Subscript size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'superscript')}
        active={formats.superscript}
        onClick={() => onFormat('superscript')}
      >
        <Superscript size={18} />
      </ToolbarButton>
      <ToolbarButton
        title={t(locale, 'inlineCode')}
        active={formats.code}
        onClick={() => onFormat('code')}
      >
        <Code size={18} />
      </ToolbarButton>
    </>
  );
});
