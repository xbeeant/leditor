import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import {
  $getRoot,
  $isElementNode,
  COMMAND_PRIORITY_LOW,
  type LexicalNode,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useEffect, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { type Locale, t } from '../i18n';

interface TocItem {
  key: string;
  text: string;
  level: number;
}

function $getHeadingList(locale: Locale): TocItem[] {
  const root = $getRoot();
  const items: TocItem[] = [];

  const visit = (node: LexicalNode) => {
    if ($isHeadingNode(node)) {
      const level = Number(node.getTag().replace('h', '')) || 1;
      items.push({
        key: node.getKey(),
        text: node.getTextContent().trim() || t(locale, 'untitledHeading'),
        level,
      });
      return;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        visit(child);
      }
    }
  };

  for (const child of root.getChildren()) {
    visit(child);
  }
  return items;
}

function $getActiveHeadingKey(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  let node = selection.anchorNode as HTMLElement | null;
  while (node && node !== document.body) {
    const key = (node as HTMLElement).getAttribute?.('data-lexical-node-key');
    if (key) return key;
    node = node.parentElement;
  }
  return null;
}

interface TableOfContentsProps {
  pinned: boolean;
}

export function TableOfContents({ pinned }: TableOfContentsProps) {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const refresh = () => {
      editor.getEditorState().read(
        () => {
          setItems($getHeadingList(locale));
        },
        { editor },
      );
    };
    refresh();
    const unregisterUpdate = editor.registerUpdateListener(refresh);
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(
          () => {
            setActiveKey($getActiveHeadingKey());
          },
          { editor },
        );
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      unregisterUpdate();
      unregisterSelection();
    };
  }, [editor, locale]);

  const handleClick = (key: string) => {
    const element = editor.getElementByKey(key);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveKey(key);
  };

  const list = (
    <ul>
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => handleClick(item.key)}
              className={`block w-full truncate py-1.5 text-left text-sm transition-colors duration-150 ${
                active
                  ? 'font-medium text-blue-500'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
              title={item.text}
            >
              {item.text}
            </button>
          </li>
        );
      })}
    </ul>
  );

  // Pinned: fixed sidebar on the right, the editor content yields its width.
  if (pinned) {
    return (
      <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-gray-50/50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">
            {t(locale, 'contents')}
          </span>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-1 pt-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400">{t(locale, 'noHeadings')}</p>
          ) : (
            list
          )}
        </div>
      </aside>
    );
  }

  // Not fixed: collapsed rail of dashes floating over the right edge. Each
  // dash length encodes the heading level (h1 widest). Hovering reveals the
  // outline as a floating card.
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="pointer-events-auto flex flex-col items-end gap-2 py-4 pr-3">
        {items.length === 0 ? (
          <span
            className="h-[2px] w-4 rounded-full bg-gray-200"
            title={t(locale, 'noHeadings')}
          />
        ) : (
          items.map((item) => {
            const active = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleClick(item.key)}
                title={item.text}
                style={{ width: `${Math.max(28 - (item.level - 1) * 4, 8)}px` }}
                className={`h-[2px] rounded-full transition-all duration-150 ${
                  active ? 'bg-gray-900' : 'bg-gray-200 hover:bg-gray-400'
                }`}
              />
            );
          })
        )}
      </div>

      {hovered && items.length > 0 && (
        <div className="pointer-events-auto absolute right-full top-0 max-h-full w-60 overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)]">
          {list}
        </div>
      )}
    </div>
  );
}
