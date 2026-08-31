import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, type NodeKey } from 'lexical';
import mermaid from 'mermaid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { $isMermaidNode } from './MermaidNode';

/**
 * Mermaid 图表的渲染与编辑组件。
 * 编辑模式下展示代码编辑区与实时预览；只读模式下渲染最终图表。
 */
export function MermaidComponent({
  nodeKey,
  code,
}: {
  nodeKey: NodeKey;
  code: string;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localCode, setLocalCode] = useState(code);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // 稳定化 mermaid 实例，避免重复初始化
  const mermaidInstance = useMemo(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    return mermaid;
  }, []);

  const renderDiagram = useCallback(async () => {
    setError(null);
    if (!localCode.trim()) {
      setSvg(null);
      return;
    }
    try {
      const renderId = `mermaid-${nodeKey}-${Date.now()}`;
      const { svg: renderedSvg } = await mermaidInstance.render(
        renderId,
        localCode,
      );
      setSvg(renderedSvg);
    } catch (err) {
      console.error('Mermaid render error:', err);
      setError((err as Error)?.message || '渲染失败');
      setSvg(null);
    }
  }, [nodeKey, localCode, mermaidInstance]);

  // 切换到只读模式时立即渲染图表
  useEffect(() => {
    if (!isEditable) {
      renderDiagram();
    }
  }, [isEditable, renderDiagram]);

  const lineNumbers = useMemo(() => {
    const lines = localCode.split('\n').length;
    return Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);
  }, [localCode]);

  // 同步 textarea 与行号侧边栏的滚动
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    setLocalCode(code);
  }, [code]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setLocalCode(newCode);

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMermaidNode(node)) {
        node.setCode(newCode);
      }
    });
  };

  if (isEditable) {
    return (
      <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-100/80 px-3 py-1.5">
          <span className="font-mono text-xs text-gray-500">mermaid</span>
          <span className="text-xs text-gray-400">
            编辑代码并在下方预览
          </span>
        </div>
        <div className="flex">
          <div
            ref={gutterRef}
            className="select-none overflow-hidden border-r border-gray-200 bg-gray-100/60 px-2 py-2 text-right font-mono text-xs leading-6 text-gray-400"
            aria-hidden
          >
            {lineNumbers.map((num) => (
              <div key={num}>{num}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={localCode}
            onChange={handleCodeChange}
            onScroll={handleScroll}
            className="min-h-24 flex-1 resize-y bg-transparent p-2 font-mono text-sm leading-6 text-gray-800 outline-none"
            spellCheck={false}
            wrap="off"
            placeholder="flowchart TD&#10;  A[Start] --> B[End]"
          />
        </div>
        <div className="overflow-x-auto border-t border-gray-200 bg-white p-3">
          {error ? (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">
              ⚠ {error}
            </div>
          ) : svg ? (
            <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="min-h-16 text-center text-xs text-gray-400">
              输入代码后点击空白处预览
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 min-h-24 overflow-x-auto">
      {error ? (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">
          ⚠ {error}
        </div>
      ) : svg ? (
        <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="min-h-16 text-center text-xs text-gray-400">
          （空图表）
        </div>
      )}
    </div>
  );
}
