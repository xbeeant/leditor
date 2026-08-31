import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isTextNode,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import { Search, X } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';

/** 普通匹配的底色 */
const MATCH_STYLE = 'background-color: rgba(250, 204, 21, 0.4);';
/** 当前激活匹配：更深的底色 + 外描边用于醒目定位 */
const ACTIVE_STYLE =
  'background-color: rgba(250, 204, 21, 0.7); outline: 2px solid #f59e0b; outline-offset: 1px; border-radius: 2px;';

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 查找与替换浮窗。核心思路（参考 ca/lexical/packages/lib）：
 * 遍历所有文本节点，把每次出现「查找词」的片段用 splitText 从原节点中拆出，
 * 对该片段套用高亮样式以标记匹配，并支持 上一个/下一个 切换、替换 与 全部替换。
 *
 * 与参考实现的差异与改进：
 *  - 同一文本节点内的多处匹配都会被处理（参考实现只处理第一处）。
 *  - 高亮片段由 ref 追踪，关闭浮窗 / 卸载 / 重新搜索时统一清除样式，
 *    避免把高亮残留在将被保存的文档内容中。
 */
export function FindReplaceDialog({
  open,
  onOpenChange,
}: FindReplaceDialogProps) {
  const [editor] = useLexicalComposerContext();
  const locale = useLocale();
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  // 当前激活的匹配序号（0 基），用于 上一个/下一个/替换
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 记录所有被高亮的匹配片段节点 key，便于统一清理
  const highlightedKeysRef = useRef<string[]>([]);
  // 当前激活匹配片段的节点 key，替换时据此精确定位
  const activeNodeKeyRef = useRef<string | null>(null);

  /** 清除上一轮搜索残留的高亮样式 */
  const clearHighlights = useCallback(() => {
    const keys = highlightedKeysRef.current;
    if (keys.length > 0) {
      editor.update(
        () => {
          for (const key of keys) {
            const node = $getNodeByKey(key);
            if ($isTextNode(node)) node.setStyle('');
          }
        },
        { tag: 'history-skip' },
      );
    }
    highlightedKeysRef.current = [];
    activeNodeKeyRef.current = null;
  }, [editor]);

  useEffect(() => {
    if (!open) return;
    // 打开浮窗时聚焦搜索框
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open]);

  // 关闭时统一清理高亮，避免污染即将保存的内容
  useEffect(() => {
    if (!open) return;
    return () => {
      clearHighlights();
      setSearchText('');
      setActiveIndex(0);
      setMatchCount(0);
    };
  }, [open, clearHighlights]);

  /**
   * 查找并高亮所有匹配片段。
   * @param value     查找词
   * @param targetIdx 需要以「激活」样式标记的匹配序号（0 基）
   */
  const findAndHighlight = useCallback(
    (value: string, targetIdx = 0) => {
      // 先清掉旧高亮，再扫描（清高亮需在独立的 update 中完成）
      clearHighlights();

      editor.update(
        () => {
          const highlighted: string[] = [];
          let count = 0;
          let activeKey: string | null = null;

          const highlightNode = (node: TextNode, isActive: boolean) => {
            node.setStyle(isActive ? ACTIVE_STYLE : MATCH_STYLE);
            highlighted.push(node.getKey());
            if (isActive) activeKey = node.getKey();
            count++;
          };

          const collect = (node: LexicalNode) => {
            if ($isTextNode(node)) {
              const text = node.getTextContent();
              if (value && text.includes(value)) {
                // 找出该节点内所有匹配边界，一次 splitText 全部拆开
                const boundaries: number[] = [];
                let idx = text.indexOf(value);
                while (idx !== -1) {
                  const start = idx;
                  const end = idx + value.length;
                  if (boundaries[boundaries.length - 1] !== start) {
                    boundaries.push(start);
                  }
                  boundaries.push(end);
                  idx = text.indexOf(value, end);
                }
                const segments = node.splitText(...boundaries);
                // 拆出的片段中，文本内容恰等于查找词的即为匹配片段
                for (const seg of segments) {
                  if (seg.getTextContent() === value) {
                    highlightNode(seg, count === targetIdx);
                  }
                }
              }
              return;
            }
            if ($isElementNode(node)) {
              for (const child of node.getChildren()) {
                collect(child);
              }
            }
          };

          $getRoot().getChildren().forEach(collect);
          highlightedKeysRef.current = highlighted;
          activeNodeKeyRef.current = activeKey;
          setMatchCount(count);
        },
        { tag: 'history-skip' },
      );

      // 激活匹配滚动到可视区域（用 rAF 确保 DOM 已完成渲染再滚动）
      let keyToScroll = activeNodeKeyRef.current;
      if (!keyToScroll) {
        keyToScroll = highlightedKeysRef.current[targetIdx] ?? null;
      }
      if (keyToScroll) {
        const scrollKey = keyToScroll;
        requestAnimationFrame(() => {
          editor.getEditorState().read(() => {
            const el = editor.getElementByKey(scrollKey);
            el?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          });
        });
      }
    },
    [editor, clearHighlights],
  );

  const runSearch = useCallback(
    (value: string, targetIdx = 0) => {
      if (value.trim() !== '') {
        findAndHighlight(value, targetIdx);
      } else {
        clearHighlights();
        setMatchCount(0);
        setActiveIndex(0);
      }
    },
    [findAndHighlight, clearHighlights],
  );

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchText(value);
      setActiveIndex(0);
      runSearch(value, 0);
    },
    [runSearch],
  );

  /**
   * 导航到已有高亮匹配中的第 targetIdx 项，仅更新样式 + 滚动，
   * 不重新遍历文档节点，避免 DOM 大规模重排导致编辑器意外滚动。
   */
  const navigateToMatch = useCallback(
    (targetIdx: number) => {
      const keys = highlightedKeysRef.current;
      if (keys.length === 0) return;

      let newActiveKey: string | null = null;
      editor.update(
        () => {
          // 重置所有高亮为普通匹配样式
          for (const key of keys) {
            const node = $getNodeByKey(key);
            if ($isTextNode(node)) node.setStyle(MATCH_STYLE);
          }
          // 将目标设为激活样式
          const targetKey = keys[targetIdx] ?? null;
          if (targetKey) {
            const node = $getNodeByKey(targetKey);
            if ($isTextNode(node)) node.setStyle(ACTIVE_STYLE);
            newActiveKey = targetKey;
          }
        },
        { tag: 'history-skip' },
      );
      activeNodeKeyRef.current = newActiveKey;

      // 滚动到激活匹配
      if (newActiveKey) {
        const scrollKey = newActiveKey;
        requestAnimationFrame(() => {
          editor.getEditorState().read(() => {
            const el = editor.getElementByKey(scrollKey);
            el?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          });
        });
      }
    },
    [editor],
  );

  const handleNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = (activeIndex + 1) % matchCount;
    setActiveIndex(next);
    navigateToMatch(next);
  }, [matchCount, activeIndex, navigateToMatch]);

  const handlePrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = (activeIndex - 1 + matchCount) % matchCount;
    setActiveIndex(prev);
    navigateToMatch(prev);
  }, [matchCount, activeIndex, navigateToMatch]);

  /** 替换当前激活匹配 */
  const handleReplace = useCallback(() => {
    const key = activeNodeKeyRef.current;
    if (!key || matchCount === 0) return;
    editor.update(
      () => {
        const node = $getNodeByKey(key);
        if ($isTextNode(node) && node.getTextContent() === searchText) {
          node.setTextContent(replaceText);
        }
      },
      { tag: 'history-skip' },
    );
    // 替换后重跑查找以刷新高亮与计数
    findAndHighlight(searchText, activeIndex);
  }, [
    editor,
    searchText,
    replaceText,
    activeIndex,
    matchCount,
    findAndHighlight,
  ]);

  /** 全部替换 */
  const handleReplaceAll = useCallback(() => {
    if (matchCount === 0) return;
    const keys = [...highlightedKeysRef.current];
    editor.update(
      () => {
        for (const key of keys) {
          const node = $getNodeByKey(key);
          if ($isTextNode(node) && node.getTextContent() === searchText) {
            node.setTextContent(replaceText);
          }
        }
      },
      { tag: 'history-skip' },
    );
    clearHighlights();
    setSearchText('');
    setMatchCount(0);
    setActiveIndex(0);
  }, [editor, searchText, replaceText, matchCount, clearHighlights]);

  // 快捷键：⌘/Ctrl+F 开合浮窗
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const nextOpen = !open;
        onOpenChange(nextOpen);
        if (nextOpen) {
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div
      className="absolute right-2.5 top-2.5 z-50 flex w-80 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* 查找输入行 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            ref={searchInputRef}
            value={searchText}
            onChange={handleSearchChange}
            onFocus={(e) => e.stopPropagation()}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch(searchText, 0);
              }
            }}
            placeholder={t(locale, 'findSearch')}
            className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            editor.focus();
          }}
          aria-label={t(locale, 'close')}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* 替换输入行 */}
      <input
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        onFocus={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={t(locale, 'findReplaceAs')}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

      {/* 计数 + 上一个/下一个 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          {matchCount > 0 ? (
            <>
              {t(locale, 'findFound')}{' '}
              <span className="font-bold text-gray-700">{matchCount}</span>{' '}
              {t(locale, 'findMatchCount')}
              <span className="ml-1 text-gray-400">
                ({t(locale, 'findCurrent')} {activeIndex + 1}
                {t(locale, 'findItem')})
              </span>
            </>
          ) : (
            t(locale, 'findNoMatch')
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={matchCount === 0}
            aria-label={t(locale, 'findPrev')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>{t(locale, 'findPrev')}</title>
              <path
                fillRule="evenodd"
                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={matchCount === 0}
            aria-label={t(locale, 'findNext')}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <title>{t(locale, 'findNext')}</title>
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => runSearch(searchText, 0)}
          className="flex-1 rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          {t(locale, 'findSearchBtn')}
        </button>
        <button
          type="button"
          onClick={handleReplace}
          disabled={matchCount === 0}
          className="flex-1 rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(locale, 'findReplaceBtn')}
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={matchCount === 0}
          className="flex-1 rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(locale, 'findReplaceAll')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
