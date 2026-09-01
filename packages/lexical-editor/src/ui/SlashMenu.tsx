import {
  Code,
  Download,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Paintbrush,
  type Pilcrow,
  Quote,
  Sigma,
  Table as TableIcon,
  Workflow,
} from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';

export type SlashAction =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'code'
  | 'bullet'
  | 'number'
  | 'check'
  | 'table'
  | 'divider'
  | 'image'
  | 'equation'
  | 'inlineEquation'
  | 'mermaid'
  | 'codeDrawing'
  | 'file';

interface SlashItem {
  keyword: string[];
  labelKey: string;
  descriptionKey: string;
  icon: typeof Pilcrow;
  action: SlashAction;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    keyword: ['text', '文本', '正文'],
    labelKey: 'paragraph',
    descriptionKey: 'slashParagraphDesc',
    icon: FileText,
    action: 'paragraph',
  },
  {
    keyword: ['h1', '标题1'],
    labelKey: 'heading1',
    descriptionKey: 'slashH1Desc',
    icon: Heading1,
    action: 'h1',
  },
  {
    keyword: ['h2', '标题2'],
    labelKey: 'heading2',
    descriptionKey: 'slashH2Desc',
    icon: Heading2,
    action: 'h2',
  },
  {
    keyword: ['h3', '标题3'],
    labelKey: 'heading3',
    descriptionKey: 'slashH3Desc',
    icon: Heading3,
    action: 'h3',
  },
  {
    keyword: ['quote', '引用'],
    labelKey: 'quote',
    descriptionKey: 'slashQuoteDesc',
    icon: Quote,
    action: 'quote',
  },
  {
    keyword: ['code', '代码'],
    labelKey: 'codeBlock',
    descriptionKey: 'slashCodeDesc',
    icon: Code,
    action: 'code',
  },
  {
    keyword: ['bullet', '列表', '无序'],
    labelKey: 'bulletList',
    descriptionKey: 'slashBulletDesc',
    icon: List,
    action: 'bullet',
  },
  {
    keyword: ['number', '有序'],
    labelKey: 'numberedList',
    descriptionKey: 'slashNumberDesc',
    icon: ListOrdered,
    action: 'number',
  },
  {
    keyword: ['check', '待办'],
    labelKey: 'checklist',
    descriptionKey: 'slashCheckDesc',
    icon: ListChecks,
    action: 'check',
  },
  {
    keyword: ['table', '表格'],
    labelKey: 'insertTable',
    descriptionKey: 'slashTableDesc',
    icon: TableIcon,
    action: 'table',
  },
  {
    keyword: ['divider', '分割线', 'hr'],
    labelKey: 'insertDivider',
    descriptionKey: 'slashDividerDesc',
    icon: Minus,
    action: 'divider',
  },
  {
    keyword: ['image', '图片'],
    labelKey: 'insertImage',
    descriptionKey: 'slashImageDesc',
    icon: ImageIcon,
    action: 'image',
  },
  {
    keyword: ['equation', '公式'],
    labelKey: 'insertEquation',
    descriptionKey: 'slashEquationDesc',
    icon: Sigma,
    action: 'equation',
  },
  {
    keyword: ['inline', '行内公式'],
    labelKey: 'insertInlineEquation',
    descriptionKey: 'slashInlineEquationDesc',
    icon: Sigma,
    action: 'inlineEquation',
  },
  {
    keyword: ['mermaid', '图表'],
    labelKey: 'insertMermaid',
    descriptionKey: 'slashMermaidDesc',
    icon: Workflow,
    action: 'mermaid',
  },
  {
    keyword: ['drawing', '代码绘图', '图形'],
    labelKey: 'codeDrawing',
    descriptionKey: 'slashCodeDrawingDesc',
    icon: Paintbrush,
    action: 'codeDrawing',
  },
  {
    keyword: ['file', '文件', '附件'],
    labelKey: 'insertFile',
    descriptionKey: 'slashFileDesc',
    icon: Download,
    action: 'file',
  },
];

interface SlashMenuProps {
  query: string;
  top: number;
  left: number;
  activeIndex: number;
  onSelect: (action: SlashAction) => void;
}

export function SlashMenu({
  query,
  top,
  left,
  activeIndex,
  onSelect,
}: SlashMenuProps): JSX.Element | null {
  const locale = useLocale();
  const filtered = SLASH_ITEMS.filter((item) =>
    item.keyword.some((kw) => kw.toLowerCase().includes(query.toLowerCase())),
  );

  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    // 滚动高亮项到可见区域
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (filtered.length === 0) {
    return (
      <div
        className="fixed z-100 w-64 rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
        style={{ top, left }}
      >
        <div className="px-3 py-2 text-sm text-gray-400">
          {t(locale, 'noMatch')}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-100 max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
      style={{ top, left }}
    >
      <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        {t(locale, 'quickInsert')}
      </div>
      {filtered.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={item.action}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            onClick={() => onSelect(item.action)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
              isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
            }`}
          >
            <item.icon
              size={16}
              className={`shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-500'}`}
            />
            <span className="flex-1 truncate">{t(locale, item.labelKey)}</span>
            <span className="shrink-0 text-xs text-gray-400">
              {t(locale, item.descriptionKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { SLASH_ITEMS };
