import { useMemo } from 'react';
import { computeDiffState } from './compute-diff-state';

/**
 * 将单个 Lexical 节点转换为带 diff 高亮的 HTML。
 * 依据 __changes 字段：added 标绿、deleted 标红。
 */
function renderNodeToHtml(node: any, deleted: boolean): string {
  if (!node) return '';

  switch (node.type) {
    case 'root':
      return (node.children || [])
        .map((c: any) => renderNodeToHtml(c, deleted))
        .join('');

    case 'heading': {
      const level = node.tag ? String(node.tag).replace('h', '') : '1';
      const inner = (node.children || [])
        .map((c: any) => renderNodeToHtml(c, deleted))
        .join('');
      return `<h${level} class="diff-heading">${inner}</h${level}>`;
    }

    case 'paragraph':
      return `<p class="diff-para">${(node.children || [])
        .map((c: any) => renderNodeToHtml(c, deleted))
        .join('')}</p>`;

    case 'quote':
      return `<blockquote class="diff-quote">${(node.children || [])
        .map((c: any) => renderNodeToHtml(c, deleted))
        .join('')}</blockquote>`;

    case 'list':
      return `<ul class="diff-list">${(node.children || [])
        .map((c: any) =>
          c.type === 'listitem'
            ? `<li>${(c.children || [])
                .map((ch: any) => renderNodeToHtml(ch, deleted))
                .join('')}</li>`
            : renderNodeToHtml(c, deleted),
        )
        .join('')}</ul>`;

    case 'code':
    case 'code-highlight': {
      const text = (node.children || []).map((c: any) => c.text ?? '').join('');
      return `<pre class="diff-code">${escapeHtml(text)}</pre>`;
    }

    case 'horizontalrule':
    case 'hr':
      return `<hr class="diff-hr" />`;

    case 'table': {
      const rows = (node.children || [])
        .map((row: any) => {
          const cells = (row.children || [])
            .map((cell: any) => {
              const inner = (cell.children || [])
                .map((c: any) => renderNodeToHtml(c, deleted))
                .join('');
              return `<td>${inner}</td>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('');
      return `<table class="diff-table"><tbody>${rows}</tbody></table>`;
    }

    case 'text':
      return renderInline(node.text || '', node, deleted);

    case 'link': {
      const text =
        (node.children || []).map((c: any) => c.text || '').join('') ||
        node.url ||
        '';
      return renderInline(text, { ...node, text }, deleted);
    }

    case 'linebreak':
      return '<br />';

    case 'image':
      return `<div class="diff-image"><img src="${escapeHtml(
        node.src || '',
      )}" alt="${escapeHtml(node.altText || '')}" /></div>`;

    case 'equation':
      return `<div class="diff-equation">${escapeHtml(
        node.texExpression || node.value || '',
      )}</div>`;

    case 'mermaid':
    case 'code-drawing':
    case 'drawio':
    case 'mind':
    case 'excalidraw':
      return `<div class="diff-block">[${node.type}]</div>`;

    default:
      if (Array.isArray(node.children) && node.children.length > 0) {
        return (node.children as any[])
          .map((c: any) => renderNodeToHtml(c, deleted))
          .join('');
      }
      return '';
  }
}

function renderInline(text: string, node: any, deleted: boolean): string {
  const change = node.__changes;
  const escaped = escapeHtml(text);
  let cls = 'diff-text';
  if (change === 'added' && !deleted) cls += ' diff-added';
  if (change === 'deleted' && deleted) cls += ' diff-deleted';

  const styleParts: string[] = [];
  const format = node.format ?? 0;
  if (format & 1) styleParts.push('font-weight:bold');
  if (format & 2) styleParts.push('font-style:italic');
  if (format & 8) styleParts.push('text-decoration:line-through');
  styleParts.push(`color:${deleted ? '#b91c1c' : '#166534'}`);

  return `<span class="${cls}"${
    styleParts.length ? ` style="${styleParts.join(';')}"` : ''
  }>${escaped}</span>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseState(value: string | any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * 差异对比编辑器：并排展示两个版本（旧 / 新），
 * 旧版中删除内容标红，新版中新增内容标绿。
 */
export function DiffEditor({
  oldValue,
  newValue,
}: {
  oldValue: string | any;
  newValue: string | any;
}) {
  const { oldHtml, newHtml } = useMemo(() => {
    const oldState = parseState(oldValue);
    const newState = parseState(newValue);
    if (!oldState?.root || !newState?.root) {
      return { oldHtml: '', newHtml: '' };
    }
    const diff = computeDiffState(oldState, newState);
    return {
      oldHtml: renderNodeToHtml(oldState, true),
      newHtml: renderNodeToHtml(diff, false),
    };
  }, [oldValue, newValue]);

  return (
    <div className="flex h-full w-full flex-row overflow-hidden border border-gray-300">
      <div className="min-w-0 flex-1 overflow-y-auto border-r border-gray-300 bg-white p-4">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
          旧版本
        </div>
        <div
          className="diff-pane"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染由编辑器状态生成的受控 HTML
          dangerouslySetInnerHTML={{ __html: oldHtml }}
        />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto bg-white p-4">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
          新版本
        </div>
        <div
          className="diff-pane"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 渲染由编辑器状态生成的受控 HTML
          dangerouslySetInnerHTML={{ __html: newHtml }}
        />
      </div>

      <style>{`
        .diff-pane { font-family: ui-sans-serif, system-ui, sans-serif; }
        .diff-pane p { margin: 0.4em 0; }
        .diff-pane h1,.diff-pane h2,.diff-pane h3,.diff-pane h4 { margin: 0.6em 0 0.3em; }
        .diff-pane blockquote { margin: 0.4em 0; padding-left: 0.8em; border-left: 3px solid #d1d5db; color: #4b5563; }
        .diff-pane pre { background: #f3f4f6; padding: 0.75em; border-radius: 6px; overflow-x: auto; }
        .diff-pane table { border-collapse: collapse; width: 100%; margin: 0.4em 0; }
        .diff-pane td { border: 1px solid #e5e7eb; padding: 4px 8px; }
        .diff-pane img { max-width: 100%; height: auto; }
        .diff-pane hr { margin: 0.8em 0; border: none; border-top: 1px solid #e5e7eb; }
        .diff-text.diff-added { background: rgba(34,197,94,0.25); }
        .diff-text.diff-deleted { background: rgba(239,68,68,0.25); }
      `}</style>
    </div>
  );
}
