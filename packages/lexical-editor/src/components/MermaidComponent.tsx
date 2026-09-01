import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, type NodeKey } from 'lexical';
import mermaid from 'mermaid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import { $isMermaidNode } from '../nodes';

/**
 * Mermaid 图表的渲染与编辑组件。
 * 编辑模式下展示左侧代码编辑区与右侧实时预览；只读模式下渲染最终图表。
 */

// 模块级记忆视图模式：Lexical decorator 节点更新时会重挂载组件，
// 用 Map 按 nodeKey 持久化，避免切换状态在重挂载后被重置。
const viewModeMap = new Map<string, 'code' | 'preview' | 'split'>();

export function MermaidComponent({
  nodeKey,
  code,
}: {
  nodeKey: NodeKey;
  code: string;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const locale = useLocale();

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localCode, setLocalCode] = useState(code);
  // 视图模式：code 仅代码 / preview 仅预览 / split 代码+预览，
  // 初始值从模块级 Map 恢复，保证重挂载后切换仍然生效
  const [viewMode, setViewModeState] = useState<'code' | 'preview' | 'split'>(
    () => viewModeMap.get(nodeKey) ?? 'split',
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // 稳定化 mermaid 实例，避免重复初始化。
  // suppressErrorRendering 关闭 mermaid 内置的报错图表渲染（"Syntax error in text"），
  // 否则语法错误时它会在 document.body 遗留报错 SVG 节点，且不会携带具体错误信息。
  const mermaidInstance = useMemo(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      suppressErrorRendering: true,
    });
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
      setError((err as Error)?.message || t(locale, 'renderFailed'));
      setSvg(null);
    }
  }, [nodeKey, localCode, mermaidInstance, locale]);

  // 切换到只读模式时立即渲染图表
  useEffect(() => {
    if (!isEditable) {
      renderDiagram();
    }
  }, [isEditable, renderDiagram]);

  // 编辑模式下实时渲染预览（带防抖，避免每次按键都渲染）
  useEffect(() => {
    if (!isEditable || !localCode.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      renderDiagram();
    }, 300);
    return () => clearTimeout(timer);
  }, [isEditable, localCode, renderDiagram]);

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

  // 切换视图模式：同步持久化到模块级 Map，重挂载后仍能恢复
  const setViewMode = (mode: 'code' | 'preview' | 'split') => {
    viewModeMap.set(nodeKey, mode);
    setViewModeState(mode);
  };

  // 仅代码视图：左侧代码编辑区
  const codeView = (
    <div className="flex h-80 w-full overflow-hidden">
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
        onKeyDown={(e) => {
          // 拦截 Cmd/Ctrl+A：阻止事件冒泡到编辑器根节点触发全选文档，
          // 让 textarea 保留原生"全选当前代码"行为
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
            e.stopPropagation();
          }
        }}
        readOnly={!isEditable}
        className="h-full flex-1 resize-none overflow-auto bg-transparent p-2 font-mono text-sm leading-6 text-gray-800 outline-none"
        spellCheck={false}
        wrap="off"
        placeholder="flowchart TD&#10;  A[Start] --> B[End]"
      />
    </div>
  );

  // 仅预览视图 / 预览内容
  const previewView = (
    <div className="h-80 overflow-auto bg-white p-3">
      {error ? (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">
          ⚠ {error}
        </div>
      ) : svg ? (
        <div
          ref={containerRef}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid 生成的 SVG 为可信内容
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex min-h-full items-center justify-center text-center text-xs text-gray-400">
          {localCode.trim()
            ? t(locale, 'rendering')
            : t(locale, 'codePreviewHint')}
        </div>
      )}
    </div>
  );

  // 三种视图模式的可点击切换项
  const viewButtons: { key: 'code' | 'preview' | 'split'; label: string }[] = [
    { key: 'code', label: t(locale, 'viewCode') },
    { key: 'preview', label: t(locale, 'viewPreview') },
    { key: 'split', label: t(locale, 'viewSplit') },
  ];

  // 编辑/只读模式统一渲染：均支持切换查看代码 / 预览 / 分栏，
  // 只读模式下代码区为只读（textarea readOnly）。
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {/* data-drawing-block-header：供 FloatingToolbar 碰撞检测；relative z-[60] 高于
          浮动工具栏的 z-50，即使发生重叠也能保证头部按钮浮在上层、点击不被遮挡 */}
      <div
        data-drawing-block-header="true"
        className="relative z-[60] flex items-center gap-2 border-b border-gray-200 bg-gray-100/80 px-3 py-1.5"
      >
        <span className="font-mono text-xs text-gray-500">mermaid</span>
        <div className="flex items-center gap-1">
          {viewButtons.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setViewMode(btn.key)}
              // 阻止 contenteditable 抢焦点：在编辑器内首次点击会消费事件，导致单击不触发 onClick
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded px-2 py-0.5 text-xs transition-colors hover:bg-blue-400 hover:text-white ${
                viewMode === btn.key
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      {viewMode === 'code' && codeView}
      {viewMode === 'preview' && (
        <>
          {previewView}
          {!isEditable && (
            <div className="border-t border-gray-200 px-3 py-1 text-right font-mono text-xs text-gray-400">
              {t(locale, 'readOnly')}
            </div>
          )}
        </>
      )}
      {viewMode === 'split' && (
        <div className="flex">
          <div className="flex w-1/2 min-w-0 border-r border-gray-200">
            {codeView}
          </div>
          <div className="w-1/2 min-w-0">
            {previewView}
            {!isEditable && (
              <div className="border-t border-gray-200 px-3 py-1 text-right font-mono text-xs text-gray-400">
                {t(locale, 'readOnly')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
