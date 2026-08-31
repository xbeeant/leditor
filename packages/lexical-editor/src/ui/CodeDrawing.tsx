import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { Download, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $isCodeDrawingNode,
  type CodeDrawingMode,
  type CodeDrawingType,
} from '../CodeDrawingNode';
import { renderCodeDrawing } from '../utils/renderers';

const RENDER_DEBOUNCE_DELAY = 400;
const DEFAULT_MIN_HEIGHT = 300;

const CODE_DRAWING_TYPE_ARRAY: { value: CodeDrawingType; label: string }[] = [
  { value: 'mermaid', label: 'Mermaid' },
  { value: 'plantuml', label: 'PlantUML' },
  { value: 'graphviz', label: 'Graphviz' },
  { value: 'flowchart', label: 'Flowchart' },
];

const VIEW_MODE_ARRAY: { value: CodeDrawingMode; label: string }[] = [
  { value: 'both', label: '开发模式' },
  { value: 'img', label: '仅图形' },
];

/**
 * 代码绘图节点组件：左侧代码编辑器 + 右侧渲染预览。
 * 支持 both / code / img 三种视图模式与多种图表语言的切换。
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
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const readOnly = !isEditable;

  const [image, setImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<CodeDrawingMode>(drawingMode);
  const [chartType, setChartType] = useState<CodeDrawingType>(drawingType);
  const [code, setCode] = useState(data ?? '');

  const requestIdRef = useRef(0);

  // 防抖渲染：输入停止后重新生成图表
  useEffect(() => {
    const reqId = ++requestIdRef.current;
    if (!code.trim()) {
      setImage('');
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const imageData = await renderCodeDrawing(chartType, code);
        if (requestIdRef.current === reqId) {
          setImage(imageData);
          setError(null);
        }
      } catch (err) {
        if (requestIdRef.current === reqId) {
          setError((err as Error)?.message || '渲染失败');
          setImage('');
        }
      } finally {
        if (requestIdRef.current === reqId) {
          setLoading(false);
        }
      }
    }, RENDER_DEBOUNCE_DELAY);

    return () => window.clearTimeout(timer);
  }, [code, chartType]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCodeDrawingNode(node)) node.setData(newCode);
      });
    },
    [editor, nodeKey],
  );

  const handleDrawingTypeChange = useCallback(
    (type: CodeDrawingType) => {
      setChartType(type);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCodeDrawingNode(node)) node.setDrawingType(type);
      });
    },
    [editor, nodeKey],
  );

  const handleDrawingModeChange = useCallback(
    (mode: CodeDrawingMode) => {
      setViewMode(mode);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isCodeDrawingNode(node)) node.setDrawingMode(mode);
      });
    },
    [editor, nodeKey],
  );

  const handleRemove = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      node?.remove();
    });
  }, [editor, nodeKey]);

  const handleDownload = useCallback(() => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `code-drawing-${nodeKey}.svg`;
    link.click();
  }, [image, nodeKey]);

  const showCode = viewMode === 'both' || viewMode === 'code';
  const showPreview = viewMode === 'both' || viewMode === 'img';

  return (
    <div
      className="my-4 flex w-full items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white"
      style={{ minHeight: DEFAULT_MIN_HEIGHT }}
    >
      {isEditable && showCode && (
        <div
          className={`flex min-w-0 flex-col ${showPreview ? 'border-r border-gray-200' : 'w-full'}`}
          style={{ minWidth: showPreview ? 200 : undefined }}
        >
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            spellCheck={false}
            wrap="off"
            className="min-h-40 flex-1 resize-y bg-gray-50 p-4 font-mono text-sm leading-5 text-gray-800 outline-none"
            placeholder="// 输入图表代码，例如：&#10;flowchart TD&#10;  A[Start] --> B[End]"
          />
        </div>
      )}

      {(readOnly || showPreview) && (
        <div className="relative flex min-w-0 flex-1 flex-col bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <select
              value={chartType}
              onChange={(e) =>
                handleDrawingTypeChange(e.target.value as CodeDrawingType)
              }
              disabled={readOnly}
              className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700 outline-none"
            >
              {CODE_DRAWING_TYPE_ARRAY.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {isEditable && (
              <select
                value={viewMode}
                onChange={(e) =>
                  handleDrawingModeChange(e.target.value as CodeDrawingMode)
                }
                className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700 outline-none"
              >
                {VIEW_MODE_ARRAY.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto">
            {loading ? (
              <div className="text-xs text-gray-400">渲染中...</div>
            ) : error ? (
              <div className="max-w-full rounded bg-red-50 p-2 text-xs text-red-600 break-words">
                ⚠ {error}
              </div>
            ) : image ? (
              <img
                src={image}
                alt="Code drawing"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-xs text-gray-400">
                {code.trim() ? '渲染中...' : '预览将显示在这里'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 选中面板操作：下载 / 删除 */}
      {isEditable && isSelected && (
        <div className="flex flex-col items-center gap-1 border-l border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!image}
            title="导出"
            className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-40"
          >
            <Download className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleRemove}
            title="删除"
            className="rounded p-1 text-gray-500 hover:bg-gray-200"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
