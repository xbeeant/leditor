import type { CommentAnchor } from './types';

/**
 * 非破坏性评论锚点工具：
 * 评论范围以「全文文本偏移」形式保存在评论后端（而非编辑器状态），
 * 渲染时再映射回 DOM Range，因此评论功能完全不修改文档 JSON。
 */

/** 单个文本节点在全文中的覆盖区间 */
interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

/** 元素节点内容的起止偏移（用于元素选区边界的换算） */
interface ElementBoundary {
  start: number;
  end: number;
}

/** 编辑器根节点的全文文本索引 */
export interface TextIndex {
  segments: TextSegment[];
  elements: Map<Element, ElementBoundary>;
  nodeStart: Map<Text, number>;
  /** 全文拼接文本（与 segments 一一对应） */
  text: string;
}

/** quote 前后保留的上下文字符数，用于编辑后的模糊重定位 */
const CONTEXT_LENGTH = 24;

/** 递归遍历 DOM，构建全文文本索引 */
export function buildTextIndex(root: HTMLElement | null): TextIndex {
  const segments: TextSegment[] = [];
  const elements = new Map<Element, ElementBoundary>();
  const nodeStart = new Map<Text, number>();
  let pos = 0;

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      // 空文本节点也记录位置，可能成为选区/光标边界
      nodeStart.set(textNode, pos);
      if (textNode.data.length > 0) {
        segments.push({
          node: textNode,
          start: pos,
          end: pos + textNode.data.length,
        });
        pos += textNode.data.length;
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const start = pos;
      for (const child of Array.from(el.childNodes)) {
        visit(child);
      }
      elements.set(el, { start, end: pos });
    }
    // 注释节点等其它类型不参与文本坐标
  };

  if (root) {
    visit(root);
  }

  return {
    segments,
    elements,
    nodeStart,
    text: segments.map((s) => s.node.data).join(''),
  };
}

/** 把 (节点, 偏移) 边界换算成全文偏移 */
function boundaryToOffset(
  index: TextIndex,
  node: Node,
  offset: number,
): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const start = index.nodeStart.get(node as Text);
    return start === undefined ? null : start + offset;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const boundary = index.elements.get(node as Element);
    if (!boundary) {
      return null;
    }
    const children = node.childNodes;
    if (offset >= children.length) {
      return boundary.end;
    }
    // 边界 = 第 offset 个子节点内容之前的全局位置
    const child = children[offset];
    if (child.nodeType === Node.TEXT_NODE) {
      const start = index.nodeStart.get(child as Text);
      if (start !== undefined) {
        return start;
      }
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      const elBoundary = index.elements.get(child as Element);
      if (elBoundary) {
        return elBoundary.start;
      }
    }
    return boundary.end;
  }
  return null;
}

/** DOM Range → 全文偏移区间 */
export function rangeToOffsets(
  index: TextIndex,
  range: Range,
): { start: number; end: number } | null {
  const start = boundaryToOffset(
    index,
    range.startContainer,
    range.startOffset,
  );
  const end = boundaryToOffset(index, range.endContainer, range.endOffset);
  if (start === null || end === null || start > end) {
    return null;
  }
  return { start, end };
}

/** 在全文索引中定位某个偏移所在的 (文本节点, 节点内偏移) */
function locate(
  index: TextIndex,
  offset: number,
): { node: Text; offset: number } | null {
  const segments = index.segments;
  // 二分找第一个 end > offset 的段
  let lo = 0;
  let hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].end > offset) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  const seg = segments[lo];
  if (seg && seg.start <= offset && offset < seg.end) {
    return { node: seg.node, offset: offset - seg.start };
  }
  return null;
}

/** 全文偏移区间 → DOM Range（用于绘制层高亮 / 滚动定位） */
export function offsetsToRange(
  index: TextIndex,
  start: number,
  end: number,
): Range | null {
  const startPos = locate(index, start);
  if (!startPos) {
    return null;
  }
  // 终点可能正好在全文末尾（超出最后一个段的 end）
  const endPos =
    locate(index, end) ??
    (end === index.text.length && index.segments.length > 0
      ? {
          node: index.segments[index.segments.length - 1].node,
          offset:
            index.segments[index.segments.length - 1].end -
            index.segments[index.segments.length - 1].start,
        }
      : null);
  if (!endPos) {
    return null;
  }
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}

/** 视口坐标 → 全文偏移（评论气泡的点击命中检测） */
export function pointToOffset(
  index: TextIndex,
  x: number,
  y: number,
): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node) {
    return null;
  }
  return boundaryToOffset(index, node, offset);
}

/** 根据全文偏移和上下文，为一段选区生成可持久化的锚点 */
export function createAnchorFromRange(
  index: TextIndex,
  range: Range,
): CommentAnchor | null {
  const offsets = rangeToOffsets(index, range);
  if (!offsets || offsets.end <= offsets.start) {
    return null;
  }
  const { start, end } = offsets;
  return {
    start,
    end,
    quote: index.text.slice(start, end),
    prefix: index.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: index.text.slice(end, end + CONTEXT_LENGTH),
  };
}

/**
 * 前后文匹配得分（前缀从后往前比，后缀从前往后比）。
 * spanLength 指定 quote 的预期长度，用于计算后缀起点；
 * 在 quote 被修改掉的纯上下文回退阶段，传入 -1 表示跳过后缀匹配。
 */
function contextScore(
  text: string,
  at: number,
  anchor: CommentAnchor,
  spanLength: number = anchor.quote.length,
): number {
  let score = 0;
  if (anchor.prefix) {
    const before = text.slice(Math.max(0, at - anchor.prefix.length), at);
    let i = before.length;
    let j = anchor.prefix.length;
    while (i > 0 && j > 0 && before[i - 1] === anchor.prefix[j - 1]) {
      score++;
      i--;
      j--;
    }
  }
  if (anchor.suffix && spanLength >= 0) {
    const after = text.slice(
      at + spanLength,
      at + spanLength + anchor.suffix.length,
    );
    let i = 0;
    while (
      i < after.length &&
      i < anchor.suffix.length &&
      after[i] === anchor.suffix[i]
    ) {
      score++;
      i++;
    }
  }
  return score;
}

/**
 * 在全文中按 prefix 找候选 start 位置，再用 suffix 辅助打分，
 * 选总分最高 + 离原锚点最近的。这是「quote 本身被修改」后的最后兜底。
 *
 * 只用 prefix 做 start 定位，是因为当 quote 长度变化时，
 * suffix 反推 start 会不准（不知道新 quote 的精确长度）。
 * end 则用 prefix 之后最近的 suffix 位置推导，得到更准确的 quote 跨度；
 * 只有找不到 suffix 时才退回到原 QUOTE_LEN 估算。
 */
function contextOnlySearch(
  text: string,
  anchor: CommentAnchor,
): { start: number; end: number; score: number } | null {
  const QUOTE_LEN = anchor.quote.length || 0;
  const prefix = anchor.prefix;
  const suffix = anchor.suffix;

  if (!prefix && !suffix) {
    return null;
  }

  let best: { start: number; end: number; score: number } | null = null;

  if (prefix) {
    let from = 0;
    for (let found = 0; found < 64; found++) {
      const at = text.indexOf(prefix, from);
      if (at < 0) break;
      from = at + 1;
      const start = at + prefix.length;
      // 优先用 suffix 在 prefix 之后的出现位置推导 end（quote 长度变化时更准）
      let end = start + QUOTE_LEN;
      if (suffix) {
        const suffixAt = text.indexOf(suffix, start);
        if (
          suffixAt >= 0 &&
          suffixAt >= start &&
          suffixAt <= start + QUOTE_LEN * 2
        ) {
          // suffix 前可能有 0-1 个空格作为分隔（原始 suffix 通常以空格开头）
          end = suffixAt;
        }
      }
      if (end > text.length) end = text.length;
      const score = contextScore(text, start, anchor, end - start);
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          Math.abs(start - anchor.start) < Math.abs(best.start - anchor.start))
      ) {
        best = { start, end, score };
      }
    }
  } else if (suffix) {
    // 没有 prefix 时的退化：用 suffix 反推 start
    let from = 0;
    for (let found = 0; found < 64; found++) {
      const at = text.indexOf(suffix, from);
      if (at < 0) break;
      from = at + 1;
      const start = Math.max(0, at - QUOTE_LEN);
      const end = at;
      if (end > text.length) continue;
      const score = contextScore(text, start, anchor, end - start);
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          Math.abs(start - anchor.start) < Math.abs(best.start - anchor.start))
      ) {
        best = { start, end, score };
      }
    }
  }

  return best;
}

/** 锚点解析命中层级 */
export type AnchorResolveLevel = 1 | 2 | 3;

/** resolveAnchor 返回值，包含新偏移 + 命中层级，供上层决定是否回写锚点 */
export interface ResolvedAnchor {
  start: number;
  end: number;
  /** 1=精确命中 2=quote全文搜索 3=纯上下文兜底 */
  level: AnchorResolveLevel;
}

/**
 * 用新偏移和当前索引重建一条完整锚点（新 quote/prefix/suffix 从当前文档提取）。
 * 在 resolveAnchor 成功后调用，把锚点"追赶"到最新文本位置。
 */
export function createAnchorFromOffsets(
  index: TextIndex,
  start: number,
  end: number,
): CommentAnchor {
  const startClamped = Math.max(0, Math.min(start, index.text.length));
  const endClamped = Math.max(startClamped, Math.min(end, index.text.length));
  return {
    start: startClamped,
    end: endClamped,
    quote: index.text.slice(startClamped, endClamped),
    prefix: index.text.slice(
      Math.max(0, startClamped - CONTEXT_LENGTH),
      startClamped,
    ),
    suffix: index.text.slice(endClamped, endClamped + CONTEXT_LENGTH),
  };
}

/**
 * 解析锚点为当前文档的偏移区间，三级回退：
 *   1. 按原偏移精确命中 — 完全没改位置也没变内容
 *   2. quote 全文搜索 + 前后文打分 — 位置漂移但内容未改
 *   3. 纯 prefix + suffix 上下文搜索 — quote 本身被修改了
 * 同分时取离原位置最近的匹配，尽量容忍编辑导致的偏移漂移。
 *
 * 返回命中层级以便调用方决定是否回写锚点：
 *   Level 1 / 2 结果可信，应该回写；
 *   Level 3 是兜底猜测，只用于定位但不覆盖原始锚点。
 */
export function resolveAnchor(
  index: TextIndex,
  anchor: CommentAnchor,
): ResolvedAnchor | null {
  const { text } = index;

  // —— 第一层：精确命中 ——
  if (
    anchor.start >= 0 &&
    anchor.end <= text.length &&
    anchor.start <= anchor.end &&
    text.slice(anchor.start, anchor.end) === anchor.quote
  ) {
    return { start: anchor.start, end: anchor.end, level: 1 };
  }

  // —— 第二层：quote 全文搜索 ——
  if (anchor.quote && anchor.quote.length <= text.length) {
    let best: { start: number; end: number; score: number } | null = null;
    let from = 0;
    // 限制候选数量，避免超大文档中重复文本导致的性能问题
    for (let found = 0; found < 64; found++) {
      const at = text.indexOf(anchor.quote, from);
      if (at < 0) break;
      from = at + 1;
      const candidate = {
        start: at,
        end: at + anchor.quote.length,
        score: contextScore(text, at, anchor),
      };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score &&
          Math.abs(candidate.start - anchor.start) <
            Math.abs(best.start - anchor.start))
      ) {
        best = candidate;
      }
    }
    if (best) {
      return { start: best.start, end: best.end, level: 2 };
    }
  }

  // —— 第三层：纯上下文搜索（quote 被修改时的兜底，不回写） ——
  const ctxOnly = contextOnlySearch(text, anchor);
  if (ctxOnly) {
    return { start: ctxOnly.start, end: ctxOnly.end, level: 3 };
  }

  return null;
}
