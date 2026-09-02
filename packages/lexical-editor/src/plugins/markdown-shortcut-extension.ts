import {
  TRANSFORMERS,
  type Transformer,
  registerMarkdownShortcuts,
} from '@lexical/markdown';
import { defineExtension } from 'lexical';

export type MarkdownShortcutConfig = {
  transformers?: Transformer[];
};

export const MarkdownShortcutExtension = defineExtension({
  name: '@leditor/markdown-shortcut',
  config: {} as MarkdownShortcutConfig,
  register(editor, config) {
    const transformers = config?.transformers ?? TRANSFORMERS;
    return registerMarkdownShortcuts(editor, transformers);
  },
});
