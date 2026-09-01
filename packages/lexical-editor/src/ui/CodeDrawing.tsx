import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../LocaleContext';
import { t } from '../i18n';
import {
  $isCodeDrawingNode,
  type CodeDrawingMode,
  type CodeDrawingType,
} from '../nodes';
import { renderCodeDrawing } from '../utils';
import { ImageViewer } from './ImageViewer';

// 图表类型下拉项：与节点序列化字段 drawingType 对应
const CODE_DRAWING_TYPE_ARRAY: { value: CodeDrawingType; label: string }[] = [
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'plantuml', label: 'PlantUML' },
  { value: 'graphviz', label: 'Graphviz' },
  { value: 'flowchart', label: 'Flowchart' },
];

// 节点序列化字段 drawingMode（both/code/img）与视图模式（split/code/preview）互转，
// 保持旧文档兼容的同时 UI 与 Mermaid 块保持一致
function toViewMode(mode: CodeDrawingMode): 'code' | 'preview' | 'split' {
  if (mode === 'code') return 'code';
  if (mode === 'img') return 'preview';
  return 'split';
}

function toDrawingMode(view: 'code' | 'preview' | 'split'): CodeDrawingMode {
  if (view === 'code') return 'code';
  if (view === 'preview') return 'img';
  return 'both';
}

// 模块级记忆视图模式：decorator 节点更新时会重挂载组件，
// 用 Map 按 nodeKey 持久化，避免切换状态在重挂载后被重置。
const viewModeMap = new Map<string, 'code' | 'preview' | 'split'>();

/**
 * 通过 DOM 收集文档中所有 <img> 标签的 src，
 * 作为全屏查看器"上一张/下一张"的导航数据源。
 */
function collectImageSrcs(): string[] {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
  return imgs
    .map((img) => img.currentSrc || img.src)
    .filter((src): src is string => Boolean(src) && src !== 'data:,');
}

/**
 * 代码绘图节点组件，交互与 Mermaid 块保持一致：
 * 头部工具条（图表类型下拉框 + 代码/预览/分栏切换），
 * 编辑模式下展示左侧代码编辑区与右侧实时预览；只读模式下仅支持查看。
 */
export function CodeDrawing({
  nodeKey,
  data,
  drawingType = 'mermaid',
  drawingMode = 'both',
}: {
  nodeKey: NodeKey;
  data: string;
  drawingType?: CodeDrawingType;
  drawingMode?: CodeDrawingMode;
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const locale = useLocale();

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localCode, setLocalCode] = useState(data);
  const [chartType, setChartType] = useState<CodeDrawingType>(drawingType);
  // 视图模式：code 仅代码 / preview 仅预览 / split 代码+预览，
  // 初始值从模块级 Map 恢复（其次取节点序列化的 drawingMode），保证重挂载后切换仍然生效
  const [viewMode, setViewModeState] = useState<'code' | 'preview' | 'split'>(
    () => viewModeMap.get(nodeKey) ?? toViewMode(drawingMode),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  // 全屏图片查看器：当前图片 src 与可导航图片列表
  const [viewer, setViewer] = useState<{ src: string; srcs: string[] } | null>(
    null,
  );
  // 请求序号：忽略过期的异步渲染结果，避免慢请求覆盖新内容
  const requestIdRef = useRef(0);

  const renderDiagram = useCallback(async () => {
    setError(null);
    if (!localCode.trim()) {
      setSvg(null);
      return;
    }
    const reqId = ++requestIdRef.current;
    try {
      const renderedSvg = await renderCodeDrawing(chartType, localCode, locale);
      if (requestIdRef.current === reqId) {
        setSvg(renderedSvg || null);
        setError(null);
      }
    } catch (err) {
      if (requestIdRef.current === reqId) {
        setError((err as Error)?.message || t(locale, 'renderFailed'));
        setSvg(null);
      }
    }
  }, [chartType, localCode, locale]);

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

  // 外部更新（如撤销）时同步本地代码
  useEffect(() => {
    setLocalCode(data);
  }, [data]);

  // 外部更新时同步图表类型
  useEffect(() => {
    setChartType(drawingType);
  }, [drawingType]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setLocalCode(newCode);

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCodeDrawingNode(node)) {
        node.setData(newCode);
      }
    });
  };

  // 切换图表类型：同步持久化到节点，保存文档后刷新仍能恢复
  const handleTypeChange = (type: CodeDrawingType) => {
    setChartType(type);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCodeDrawingNode(node)) {
        node.setDrawingType(type);
      }
    });
  };

  // 切换视图模式：同步持久化到模块级 Map 与节点序列化字段，重挂载/刷新后仍能恢复
  const setViewMode = (mode: 'code' | 'preview' | 'split') => {
    viewModeMap.set(nodeKey, mode);
    setViewModeState(mode);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isCodeDrawingNode(node)) {
        node.setDrawingMode(toDrawingMode(mode));
      }
    });
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

  // 处理双击预览：把当前渲染的 SVG 转为图片，并与文档中所有 <img> 标签
  // 一起纳入全屏查看器的可导航列表（上一张/下一张）
  const handlePreviewDoubleClick = () => {
    if (!svg) return;
    const imgSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    // 通过 DOM 收集文档中所有 <img> 标签的 src 作为导航数据源
    const srcs = collectImageSrcs();
    // 当前图若已在列表中则复用其索引，否则追加到末尾
    if (!srcs.includes(imgSrc)) {
      srcs.push(imgSrc);
    }
    setViewer({ src: imgSrc, srcs });
  };

  // 仅预览视图 / 预览内容（与 Mermaid 块一致：内联渲染 SVG，
  // 并约束 SVG 宽度自适应容器、高度等比、水平居中）
  const previewView = (
    <div className="h-80 overflow-auto bg-white p-3">
      {error ? (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">
          ⚠ {error}
        </div>
      ) : svg ? (
        <div
          ref={containerRef}
          onDoubleClick={handlePreviewDoubleClick}
          className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 代码绘图导出的 SVG 为可信内容
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
  // 只读模式下代码区为只读（textarea readOnly）、类型下拉框禁用。
  return (
    <>
      <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {/* data-drawing-block-header：供 FloatingToolbar 碰撞检测；relative z-[60] 高于
          浮动工具栏的 z-50，即使发生重叠也能保证头部按钮浮在上层、点击不被遮挡 */}
        <div
          data-drawing-block-header="true"
          className="relative z-[60] flex items-center gap-2 border-b border-gray-200 bg-gray-100/80 px-3 py-1.5"
        >
          <span className="font-mono text-xs text-gray-500">code-drawing</span>
          <select
            value={chartType}
            onChange={(e) =>
              handleTypeChange(e.target.value as CodeDrawingType)
            }
            disabled={!isEditable}
            className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-700 outline-none"
          >
            {CODE_DRAWING_TYPE_ARRAY.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
      {viewer && (
        <ImageViewer
          src={viewer.src}
          srcs={viewer.srcs}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
