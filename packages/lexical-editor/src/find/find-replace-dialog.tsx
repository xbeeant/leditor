import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isTextNode,
  type LexicalNode,
} from 'lexical';
import { Regex, Search, X } from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../context';
import { t } from '../i18n';
import './highlight.css';

/** CSS Custom Highlight API 注册名 */
const HIGHLIGHT_ALL = 'leditor-find-match';
const HIGHLIGHT_ACTIVE = 'leditor-find-active';

/** 单个匹配项的元信息（只读收集，不修改文档） */
interface MatchInfo {
  nodeKey: string;
  start: number;
  end: number;
}

interface FindReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 查找与替换浮窗（非破坏性实现）。
 *
 * 核心思路：
 *  - 搜索时只读遍历文档节点，收集匹配位置，通过 CSS Custom Highlight API
 *    在绘制层渲染高亮，完全不修改文档节点树和样式。
 *  - 关闭浮窗时只需清除 CSS highlights，无需还原任何 mark/样式。
 *  - 替换时仅修改 TextNode 的文本内容（setTextContent），节点原有的
 *    格式（粗体、斜体等）和样式（inline style）均被保留。
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [regexError, setRegexError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  /** 所有匹配项的元信息（只读，不修改文档） */
  const matchesRef = useRef<MatchInfo[]>([]);

  // ─── 匹配查找 ───────────────────────────────────────────────

  /**
   * 校验正则是否合法，非法时返回错误信息，合法返回空串。
   */
  const validateRegex = useCallback(
    (value: string): string => {
      if (!useRegex) return '';
      try {
        new RegExp(value, caseSensitive ? 'g' : 'gi');
        return '';
      } catch {
        return 'Invalid regex';
      }
    },
    [useRegex, caseSensitive],
  );

  /**
   * 构建匹配函数：在单个 TextNode 的文本中找出所有匹配位置。
   */
  const buildMatcher = useCallback(
    (value: string) => {
      if (useRegex) {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(value, flags);
        return (text: string): Array<{ start: number; end: number }> => {
          const results: Array<{ start: number; end: number }> = [];
          let m: RegExpExecArray | null = regex.exec(text);
          while (m !== null) {
            if (m[0].length === 0) {
              regex.lastIndex++;
              m = regex.exec(text);
              continue;
            }
            results.push({ start: m.index, end: m.index + m[0].length });
            m = regex.exec(text);
          }
          return results;
        };
      }
      return (text: string): Array<{ start: number; end: number }> => {
        const results: Array<{ start: number; end: number }> = [];
        const needle = caseSensitive ? value : value.toLowerCase();
        const haystack = caseSensitive ? text : text.toLowerCase();
        let idx = haystack.indexOf(needle);
        while (idx !== -1) {
          results.push({ start: idx, end: idx + value.length });
          idx = haystack.indexOf(needle, idx + 1);
        }
        return results;
      };
    },
    [caseSensitive, useRegex],
  );

  /**
   * 只读遍历文档，收集所有匹配项。
   * 返回的 MatchInfo 不含任何文档修改操作。
   */
  const collectMatches = useCallback(
    (value: string): MatchInfo[] => {
      const matcher = buildMatcher(value);
      if (!matcher) return [];

      // $ 前缀函数（$getRoot / $isTextNode 等）必须在 editor.read / update
      // 上下文内调用，因此在只读上下文中遍历节点。
      let collected: MatchInfo[] = [];
      editor.getEditorState().read(() => {
        const matches: MatchInfo[] = [];
        const collect = (node: LexicalNode) => {
          if ($isTextNode(node)) {
            const text = node.getTextContent();
            if (text) {
              for (const m of matcher(text)) {
                matches.push({
                  nodeKey: node.getKey(),
                  start: m.start,
                  end: m.end,
                });
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
        collected = matches;
      });
      return collected;
    },
    [buildMatcher, editor],
  );

  // ─── CSS Custom Highlight API 高亮渲染 ──────────────────────

  /**
   * 将 MatchInfo[] 映射为 DOM Range 并注册到 CSS.highlights。
   * 高亮仅存在于浏览器绘制层，不触碰 DOM 结构和文档 JSON。
   */
  const applyHighlights = useCallback(
    (matches: MatchInfo[], activeIdx: number) => {
      if (typeof Highlight === 'undefined' || !CSS.highlights) {
        return;
      }

      const all = new Highlight();
      const active = new Highlight();

      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const element = editor.getElementByKey(m.nodeKey);
        if (!element) continue;

        const range = createRangeFromMatch(element, m.start, m.end);
        if (!range) continue;

        all.add(range);
        if (i === activeIdx) {
          active.add(range);
        }
      }

      CSS.highlights.set(HIGHLIGHT_ALL, all);
      CSS.highlights.set(HIGHLIGHT_ACTIVE, active);
    },
    [editor],
  );

  /** 清除所有查找高亮 */
  const clearHighlights = useCallback(() => {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete(HIGHLIGHT_ALL);
      CSS.highlights.delete(HIGHLIGHT_ACTIVE);
    }
  }, []);

  // ─── 查找入口 ───────────────────────────────────────────────

  /**
   * 执行搜索：只读收集匹配 → CSS 高亮 → 更新计数。
   * 整个过程不修改文档节点树。
   */
  const performSearch = useCallback(
    (value: string, targetIdx = 0) => {
      clearHighlights();

      // 正则模式下校验合法性；非法时清空匹配并提示，不执行搜索
      const error = validateRegex(value);
      setRegexError(error);
      if (error) {
        matchesRef.current = [];
        setMatchCount(0);
        setActiveIndex(0);
        return;
      }

      if (!value.trim()) {
        matchesRef.current = [];
        setMatchCount(0);
        setActiveIndex(0);
        return;
      }

      const matches = collectMatches(value);
      matchesRef.current = matches;
      const count = matches.length;
      const idx = count > 0 ? Math.min(targetIdx, count - 1) : 0;
      setMatchCount(count);
      setActiveIndex(idx);
      applyHighlights(matches, idx);

      // 滚动到激活匹配
      if (count > 0) {
        const key = matches[idx].nodeKey;
        requestAnimationFrame(() => {
          editor.getEditorState().read(() => {
            const el = editor.getElementByKey(key);
            el?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          });
        });
      }
    },
    [clearHighlights, collectMatches, applyHighlights, editor, validateRegex],
  );

  // ─── 导航 ───────────────────────────────────────────────────

  const navigateToMatch = useCallback(
    (targetIdx: number) => {
      const matches = matchesRef.current;
      if (matches.length === 0) return;
      const idx =
        ((targetIdx % matches.length) + matches.length) % matches.length;
      setActiveIndex(idx);
      applyHighlights(matches, idx);

      const key = matches[idx].nodeKey;
      requestAnimationFrame(() => {
        editor.getEditorState().read(() => {
          const el = editor.getElementByKey(key);
          el?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        });
      });
    },
    [applyHighlights, editor],
  );

  const handleNext = useCallback(() => {
    if (matchCount === 0) return;
    navigateToMatch(activeIndex + 1);
  }, [matchCount, activeIndex, navigateToMatch]);

  const handlePrev = useCallback(() => {
    if (matchCount === 0) return;
    navigateToMatch(activeIndex - 1);
  }, [matchCount, activeIndex, navigateToMatch]);

  // ─── 替换 ───────────────────────────────────────────────────

  /**
   * 替换当前激活匹配：仅修改 TextNode 的文本内容，
   * 节点原有的 format（粗体/斜体等）和 style（inline CSS）均被保留。
   */
  const handleReplace = useCallback(() => {
    const matches = matchesRef.current;
    if (activeIndex >= matches.length || matchCount === 0) return;
    const m = matches[activeIndex];

    editor.update(
      () => {
        const node = $getNodeByKey(m.nodeKey);
        if (!$isTextNode(node)) return;
        const fullText = node.getTextContent();
        // 验证文本未被外部修改
        if (fullText.slice(m.start, m.end) !== searchText) return;
        const newText =
          fullText.slice(0, m.start) + replaceText + fullText.slice(m.end);
        node.setTextContent(newText);
      },
      { tag: 'history-skip' },
    );

    // 替换后重新搜索刷新高亮
    performSearch(searchText, activeIndex);
  }, [editor, searchText, replaceText, activeIndex, matchCount, performSearch]);

  /**
   * 全部替换：遍历所有匹配项逐个替换文本内容，样式/格式原样保留。
   * 从后往前替换，避免前面的替换影响后续匹配的偏移。
   */
  const handleReplaceAll = useCallback(() => {
    const matches = matchesRef.current;
    if (matches.length === 0 || !searchText) return;

    // 从后往前替换，避免偏移错乱
    const sorted = [...matches].sort((a, b) => {
      if (a.nodeKey !== b.nodeKey) return a.nodeKey < b.nodeKey ? -1 : 1;
      return b.start - a.start;
    });

    editor.update(
      () => {
        for (const m of sorted) {
          const node = $getNodeByKey(m.nodeKey);
          if (!$isTextNode(node)) continue;
          const fullText = node.getTextContent();
          if (fullText.slice(m.start, m.end) !== searchText) continue;
          const newText =
            fullText.slice(0, m.start) + replaceText + fullText.slice(m.end);
          node.setTextContent(newText);
        }
      },
      { tag: 'history-skip' },
    );

    clearHighlights();
    matchesRef.current = [];
    setSearchText('');
    setMatchCount(0);
    setActiveIndex(0);
  }, [editor, searchText, replaceText, clearHighlights]);

  // ─── 搜索选项变更时重新搜索 ────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (searchText.trim()) {
        performSearch(searchText, 0);
      } else {
        clearHighlights();
        matchesRef.current = [];
        setMatchCount(0);
        setActiveIndex(0);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [searchText, open, performSearch, clearHighlights]);

  // ─── 内容变更监听：编辑器更新后防抖重新搜索 ────────────────

  useEffect(() => {
    if (!open || !searchText.trim()) return;
    let frame = 0;
    const unregister = editor.registerUpdateListener(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        performSearch(searchText, activeIndex);
      });
    });
    return () => {
      unregister();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open, searchText, activeIndex, editor, performSearch]);

  // ─── 打开/关闭 行为 ────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return () => {
      clearHighlights();
      matchesRef.current = [];
      setSearchText('');
      setReplaceText('');
      setMatchCount(0);
      setActiveIndex(0);
      setCaseSensitive(false);
      setUseRegex(false);
      setRegexError('');
    };
  }, [open, clearHighlights]);

  // ─── 快捷键 ⌘/Ctrl+F ──────────────────────────────────────

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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearchText(e.target.value)
            }
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handlePrev();
                } else {
                  handleNext();
                }
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

      {/* 搜索选项：大小写敏感 + 正则 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCaseSensitive((v) => !v)}
          title={t(locale, 'findCaseSensitive')}
          className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
            caseSensitive
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <span className="leading-none">Aa</span>
        </button>
        <button
          type="button"
          onClick={() => setUseRegex((v) => !v)}
          title={t(locale, 'findRegex')}
          className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
            useRegex
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          <Regex size={12} />
        </button>
        {regexError && (
          <span className="ml-1 text-[10px] text-red-500">{regexError}</span>
        )}
      </div>

      {/* 替换输入行 */}
      <input
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        onFocus={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={t(locale, 'findReplaceAs')}
        className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-100"
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
          onClick={() => performSearch(searchText, 0)}
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

// ─── 工具函数 ─────────────────────────────────────────────────

/**
 * 将 Lexical TextNode 内的匹配偏移映射为 DOM Range。
 * 通过 TreeWalker 遍历 DOM 子节点，处理 TextNode 内可能存在的
 * 内联格式元素（如 <strong>、<em> 等）导致的多层 DOM 结构。
 */
function createRangeFromMatch(
  element: HTMLElement,
  startOffset: number,
  endOffset: number,
): Range | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let currentOffset = 0;
  let startNode: Text | null = null;
  let startObj = 0;
  let endNode: Text | null = null;
  let endObj = 0;

  let node: Text | null = walker.nextNode() as Text;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (!startNode && currentOffset + len >= startOffset) {
      startNode = node;
      startObj = startOffset - currentOffset;
    }
    if (currentOffset + len >= endOffset) {
      endNode = node;
      endObj = endOffset - currentOffset;
      break;
    }
    currentOffset += len;
    node = walker.nextNode() as Text;
  }

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startObj);
    range.setEnd(endNode, endObj);
    return range;
  }
  return null;
}
