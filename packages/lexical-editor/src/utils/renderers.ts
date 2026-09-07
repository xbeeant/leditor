import type { Locale } from '../i18n';
import { t } from '../i18n';
import type { CodeDrawingType } from '../nodes/code-drawing-node';

let mermaidInitialized = false;

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 渲染 Mermaid 图表为 SVG 字符串（本地渲染，无需后端）。
 */
async function renderMermaid(content: string, locale: Locale): Promise<string> {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    // suppressErrorRendering 关闭 mermaid 内置的报错图表渲染（"Syntax error in text"），
    // 否则语法错误时它会在 document.body 遗留报错 SVG 节点，且不会携带具体错误信息。
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      suppressErrorRendering: true,
    });
    mermaidInitialized = true;
  }
  const id = `cd-mermaid-${randomString(6)}`;
  const { svg } = await mermaid.render(id, content);
  if (svg) return svg;
  throw new Error(t(locale, 'mermaidRenderFailed'));
}

/**
 * 渲染 PlantUML 图表（通过 PlantUML 在线服务）。
 * 注：需要网络环境访问 PlantUML 服务器。
 */
async function renderPlantUml(
  content: string,
  locale: Locale,
): Promise<string> {
  const plantumlEncoder = (await import('plantuml-encoder')).default;
  const encoded = plantumlEncoder.encode(content);
  const svgUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;
  const response = await fetch(svgUrl);
  if (!response.ok) {
    throw new Error(t(locale, 'plantumlRequestFailed'));
  }
  return response.text();
}

/**
 * 渲染 Graphviz 图表为 SVG 字符串（本地渲染，使用 @viz-js/viz）。
 * 输入为 DOT 语法，例如：digraph { a -> b }。
 */
async function renderGraphviz(content: string): Promise<string> {
  const { instance } = await import('@viz-js/viz');
  const viz = await instance();
  // renderString 在渲染失败时会抛出错误，交由调用方捕获
  return viz.renderString(content, { format: 'svg', engine: 'dot' });
}

/**
 * 渲染 Flowchart.js 图表为 SVG 字符串（本地渲染，使用 flowchart.js）。
 * 输入为 flowchart.js 语法，例如：st=>start: Start\nst->op\nop=>op: Op。
 */
async function renderFlowchart(
  content: string,
  locale: Locale,
): Promise<string> {
  const FlowChart = (await import('flowchart.js')).default;
  const chart = FlowChart.parse(content);
  // flowchart.js 需要一个真实挂载到 DOM 的容器才能绘制 SVG
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  try {
    chart.drawSVG(container);
    const svg = container.innerHTML;
    if (!svg) throw new Error(t(locale, 'flowchartRenderEmpty'));
    return svg;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 根据图表类型渲染代码为 SVG 字符串。
 * 内置 Mermaid / PlantUML / Graphviz / Flowchart 渲染：Mermaid、Graphviz、Flowchart
 * 为本地渲染，PlantUML 走在线服务。
 */
export async function renderCodeDrawing(
  type: CodeDrawingType,
  content: string,
  locale: Locale = 'zh-CN',
): Promise<string> {
  if (!content || !content.trim()) return '';

  switch (type) {
    case 'mermaid':
      return renderMermaid(content, locale);
    case 'plantuml':
      return renderPlantUml(content, locale);
    case 'graphviz':
      return renderGraphviz(content);
    case 'flowchart':
      return renderFlowchart(content, locale);
    default:
      throw new Error(
        t(locale, 'unsupportedChartType').replace('{type}', type),
      );
  }
}
