import {
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Sigma,
  Table as TableIcon,
} from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useRef } from 'react';

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
  | 'inlineEquation';

interface SlashItem {
  keyword: string[];
  label: string;
  description: string;
  icon: typeof Pilcrow;
  action: SlashAction;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    keyword: ['text', '文本', '正文'],
    label: '正文',
    description: '插入空段落',
    icon: FileText,
    action: 'paragraph',
  },
  {
    keyword: ['h1', '标题1'],
    label: '标题 1',
    description: '一级标题',
    icon: Heading1,
    action: 'h1',
  },
  {
    keyword: ['h2', '标题2'],
    label: '标题 2',
    description: '二级标题',
    icon: Heading2,
    action: 'h2',
  },
  {
    keyword: ['h3', '标题3'],
    label: '标题 3',
    description: '三级标题',
    icon: Heading3,
    action: 'h3',
  },
  {
    keyword: ['quote', '引用'],
    label: '引用',
    description: '引用一段文字',
    icon: Quote,
    action: 'quote',
  },
  {
    keyword: ['code', '代码'],
    label: '代码块',
    description: '插入代码块',
    icon: Code,
    action: 'code',
  },
  {
    keyword: ['bullet', '列表', '无序'],
    label: '无序列表',
    description: '插入无序列表',
    icon: List,
    action: 'bullet',
  },
  {
    keyword: ['number', '有序'],
    label: '有序列表',
    description: '插入有序列表',
    icon: ListOrdered,
    action: 'number',
  },
  {
    keyword: ['check', '待办'],
    label: '待办列表',
    description: '插入待办列表',
    icon: ListChecks,
    action: 'check',
  },
  {
    keyword: ['table', '表格'],
    label: '表格',
    description: '插入 3x3 表格',
    icon: TableIcon,
    action: 'table',
  },
  {
    keyword: ['divider', '分割线', 'hr'],
    label: '分割线',
    description: '插入水平分割线',
    icon: Minus,
    action: 'divider',
  },
  {
    keyword: ['image', '图片'],
    label: '图片',
    description: '插入图片',
    icon: ImageIcon,
    action: 'image',
  },
  {
    keyword: ['equation', '公式'],
    label: '公式',
    description: '插入块级公式',
    icon: Sigma,
    action: 'equation',
  },
  {
    keyword: ['inline', '行内公式'],
    label: '行内公式',
    description: '插入行内公式',
    icon: Sigma,
    action: 'inlineEquation',
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
        className="fixed z-[100] w-64 rounded-lg border border-gray-200 bg-white py-2 shadow-xl"
        style={{ top, left }}
      >
        <div className="px-3 py-2 text-sm text-gray-400">无匹配结果</div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[100] max-h-80 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
      style={{ top, left }}
    >
      <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        快捷插入
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
            <span className="flex-1 truncate">{item.label}</span>
            <span className="shrink-0 text-xs text-gray-400">
              {item.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { SLASH_ITEMS };
