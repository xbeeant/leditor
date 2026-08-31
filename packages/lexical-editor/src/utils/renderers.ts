import type { CodeDrawingType } from '../CodeDrawingNode';

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
 * 将渲染好的 SVG 字符串转换为可直接作为图片 src 的 data URL。
 */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * 渲染 Mermaid 图表为 SVG data URL（本地渲染，无需后端）。
 */
async function renderMermaid(content: string): Promise<string> {
  const mermaid = (await import('mermaid')).default;
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
    mermaidInitialized = true;
  }
  const id = `cd-mermaid-${randomString(6)}`;
  const { svg } = await mermaid.render(id, content);
  if (svg) return svgToDataUrl(svg);
  throw new Error('Mermaid 渲染失败');
}

/**
 * 渲染 PlantUML 图表（通过 PlantUML 在线服务）。
 * 注：需要网络环境访问 PlantUML 服务器。
 */
async function renderPlantUml(content: string): Promise<string> {
  const plantumlEncoder = (await import('plantuml-encoder')).default;
  const encoded = plantumlEncoder.encode(content);
  const svgUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;
  const response = await fetch(svgUrl);
  if (!response.ok) {
    throw new Error('PlantUML 服务器请求失败');
  }
  const svg = await response.text();
  return svgToDataUrl(svg);
}

/**
 * 根据图表类型渲染代码为 SVG data URL。
 * 当前内置对 Mermaid 的本地渲染；PlantUML / Graphviz / Flowchart
 * 通过各自服务或库实现（Graphviz 与 Flowchart 需安装对应依赖）。
 */
export async function renderCodeDrawing(
  type: CodeDrawingType,
  content: string,
): Promise<string> {
  if (!content || !content.trim()) return '';

  switch (type) {
    case 'mermaid':
      return renderMermaid(content);
    case 'plantuml':
      return renderPlantUml(content);
    case 'graphviz':
    case 'flowchart':
      throw new Error(
        `暂不支持 ${type} 渲染：请安装对应依赖或使用 Mermaid / PlantUML`,
      );
    default:
      throw new Error(`不支持的图表类型: ${type}`);
  }
}
