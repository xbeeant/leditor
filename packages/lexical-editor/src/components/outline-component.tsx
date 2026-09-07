import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isHeadingNode } from '@lexical/rich-text';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { useEffect, useState } from 'react';
import { useLocale } from '../context';
import { t } from '../i18n';

/** 大纲项接口 */
interface OutlineItem {
  key: string;
  text: string;
  level: number;
}

/** 从 Lexical 文档树中提取所有标题 */
function getHeadings(): OutlineItem[] {
  const items: OutlineItem[] = [];

  const visit = (node: LexicalNode) => {
    if ($isHeadingNode(node)) {
      const level = Number(node.getTag().replace('h', '')) || 1;
      items.push({
        key: node.getKey(),
        text: node.getTextContent().trim() || t('zh-CN', 'untitledHeading'),
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

  const root = $getRoot();
  for (const child of root.getChildren()) {
    visit(child);
  }

  return items;
}

/**
 * 大纲组件：渲染文档中所有标题的嵌套列表。
 * 点击标题可导航到对应位置。
 */
export default function OutlineComponent() {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const [items, setItems] = useState<OutlineItem[]>([]);

  useEffect(() => {
    const update = () => {
      editor.getEditorState().read(() => {
        setItems(getHeadings());
      });
    };

    update();
    return editor.registerUpdateListener(update);
  }, [editor]);

  const handleClick = (key: string) => {
    const element = editor.getElementByKey(key);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* 头部 */}
      <div className="border-b border-gray-200 bg-gray-100/80 px-3 py-2">
        <span className="text-xs font-medium text-gray-600">
          {t(locale, 'contents')}
        </span>
      </div>
      {/* 内容区域 */}
      <div className="max-h-80 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="py-2 text-xs text-gray-400">
            {t(locale, 'noHeadings')}
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => handleClick(item.key)}
                  className={`block w-full truncate py-1 text-left text-sm text-gray-600 transition-colors hover:text-gray-900 ${
                    item.level === 1 ? 'font-medium' : ''
                  }`}
                  style={{ paddingLeft: `${(item.level - 1) * 16}px` }}
                  title={item.text}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
