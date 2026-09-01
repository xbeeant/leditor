import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  type IRunOptions,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import type { LexicalEditor } from 'lexical';
import type { Locale } from '../i18n';
import { t } from '../i18n';
import {
  convertToPng,
  fetchImageAsUint8Array,
  formatListNumber,
  getImageDimensionsFromBuffer,
  normalizeDocxColor,
} from './utils';

/**
 * JSON 节点处理器：将单个 Lexical AST 节点转换为 docx 元素数组。
 * Paragraph/Table/ImageRun/TextRun 等 docx 元素并无共同基类，故使用宽泛类型。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocxNode = any;

interface ExportOptions {
  /** 文档标题（用于导出文件名） */
  title?: string;
  /** 导出的语言，用于本地化文档内的兜底文案（如链接/图片占位文本） */
  locale?: Locale;
  /** 图片 URL 转换器（例如防盗链前缀处理） */
  realUrl?: (url: string) => string;
  /** 是否渲染水印文本 */
  watermark?: string;
  /** mermaid 等 SVG 类节点的渲染回调：输入代码返回图片 URL */
  renderCodeDiagram?: (type: string, code: string) => Promise<string>;
}

export type { ExportOptions };

/**
 * 归一化文本格式标记位（Lexical format 位标志）到 docx TextRun 属性。
 * 返回可变的本地对象，最终经 TextRun 构造为 docx 运行。
 */
function applyTextFormat(
  run: IRunOptions,
  format: number,
  style?: string,
): IRunOptions {
  const result: Record<string, unknown> = { ...run };
  if (format & 1) result.bold = true; // bold
  if (format & 2) result.italics = true; // italic
  if (format & 8) result.strike = true; // strikethrough
  if (format & 16) result.underline = { type: UnderlineType.SINGLE }; // underline
  if (format & 32) result.subScript = true; // subscript
  if (format & 64) result.superScript = true; // superscript

  if (style) {
    const css: Record<string, string> = {};
    for (const rule of style.split(';')) {
      if (!rule.trim()) continue;
      const idx = rule.indexOf(':');
      if (idx !== -1) {
        css[rule.slice(0, idx).trim()] = rule.slice(idx + 1).trim();
      }
    }
    if (css.color) result.color = normalizeDocxColor(css.color);
    if (css['background-color'])
      result.highlight = normalizeDocxColor(css['background-color']);
    if (css['font-size']) {
      const px = Number.parseFloat(css['font-size']);
      if (!Number.isNaN(px)) result.size = Math.round(px * 2); // 1px ≈ 2半磅
    }
  }
  return result as IRunOptions;
}

function textRun(
  text: string,
  format: number,
  style?: string,
  isLink?: boolean,
): TextRun {
  const props: Record<string, unknown> = { text };
  if (isLink) {
    props.color = '0563C1';
    props.underline = { type: UnderlineType.SINGLE };
  }
  return new TextRun({
    ...applyTextFormat(props, format, style),
  } as IRunOptions);
}

/**
 * 深度清理控制字符，避免 docx 生成时报错。
 */
function deepCleanControlChars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // 保留常见空白，剔除其余控制字符
    // biome-ignore lint/suspicious/noControlCharactersInRegex: 有意剔除控制字符
    return obj.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepCleanControlChars(item));
  }
  if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      newObj[key] = deepCleanControlChars(
        (obj as Record<string, unknown>)[key],
      );
    }
    return newObj;
  }
  return obj;
}

export { deepCleanControlChars };

/**
 * 将 Lexical 颜色/样式字符串解析出对齐方式。
 */
function resolveAlignment(node: any) {
  switch (node.format) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

/** 将一段连续的 inline 子节点转换为 TextRun 数组。 */
function buildRuns(
  children: any[],
  locale: Locale,
  isLink?: boolean,
): TextRun[] {
  const runs: TextRun[] = [];
  for (const child of children) {
    if (child.type === 'text' || child.type === 'diff-text') {
      if (child.text) {
        runs.push(textRun(child.text, child.format ?? 0, child.style, isLink));
      }
    } else if (child.type === 'linebreak') {
      runs.push(new TextRun({ break: 1 }));
    } else if (child.type === 'link') {
      const linkText =
        child.children?.map((c: any) => c.text || '').join('') || '';
      runs.push(
        new TextRun({
          text: linkText || (child.url as string) || t(locale, 'docxLink'),
          color: '0563C1',
          underline: { type: UnderlineType.SINGLE },
        }),
      );
    }
  }
  return runs;
}

/**
 * 将 Lexical 的 list 节点转换为 docx Paragraph 数组（模拟有序/无序列表）。
 */
function buildListRuns(node: any, locale: Locale): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const listType = node.tag === 'ul' ? 'bullet' : 'number';
  let counter = 0;

  for (const listItem of node.children ?? []) {
    counter += 1;
    const itemChildren = listItem.children || [];
    const marker =
      listType === 'bullet' ? '•  ' : `${formatListNumber(counter)}. `;
    const runs: TextRun[] = [new TextRun({ text: marker })];
    runs.push(...buildRuns(itemChildren, locale));
    paragraphs.push(
      new Paragraph({
        children: runs,
        indent: {
          left: convertInchesToTwip(0.4),
          hanging: convertInchesToTwip(0.2),
        },
      }),
    );
  }
  return paragraphs;
}

/**
 * 递归将 Lexical 块级节点转换为 docx 元素列表。
 */
async function convertNodeToDocx(
  node: any,
  options: ExportOptions,
): Promise<DocxNode[]> {
  const locale: Locale = options.locale ?? 'zh-CN';
  switch (node.type) {
    case 'text':
      return node.text
        ? [textRun(node.text, node.format ?? 0, node.style)]
        : [];

    case 'paragraph': {
      const children = node.children || [];
      if (children.length === 0) {
        return [new Paragraph({ text: '' })];
      }
      const runs = buildRuns(children, locale);
      return [
        new Paragraph({
          children: runs,
          alignment: resolveAlignment(node),
          indent: node.indent ? { left: node.indent * 576 } : undefined,
        }),
      ];
    }

    case 'heading': {
      const levelMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      return [
        new Paragraph({
          text: (node.children || []).map((c: any) => c.text || '').join(''),
          heading:
            ((levelMap as Record<string, unknown>)[`${node.tag}`] as any) ||
            HeadingLevel.HEADING_1,
        }),
      ];
    }

    case 'quote': {
      const runs = buildRuns(node.children || [], locale);
      return [
        new Paragraph({
          children:
            runs.length > 0
              ? runs
              : [new TextRun({ text: (node.children?.[0]?.text ?? '') || '' })],
          indent: { left: convertInchesToTwip(0.4) },
          border: {
            left: {
              color: 'CCCCCC',
              size: 12,
              style: BorderStyle.SINGLE,
              space: 1,
            },
          },
        }),
      ];
    }

    case 'list':
      return buildListRuns(node, locale);

    case 'listitem':
      return buildRuns(node.children || [], locale).map(
        (run) => new Paragraph({ children: [run] }),
      );

    case 'code':
    case 'code-highlight': {
      const codeText = (node.children || [])
        .map((c: any) => c.text ?? '')
        .join('');
      return [
        new Paragraph({
          children: [textRun(codeText, 0, 'font-family:Consolas;')],
          shading: { fill: 'F5F5F5', type: 'clear', color: 'auto' },
          border: {
            top: { color: 'DDDDDD', size: 4, style: BorderStyle.SINGLE },
            bottom: { color: 'DDDDDD', size: 4, style: BorderStyle.SINGLE },
            left: { color: 'DDDDDD', size: 4, style: BorderStyle.SINGLE },
            right: { color: 'DDDDDD', size: 4, style: BorderStyle.SINGLE },
          },
        }),
      ];
    }

    case 'horizontalrule':
    case 'hr':
      return [new Paragraph({ text: '', thematicBreak: true })];

    case 'table': {
      const rows: TableRow[] = (node.children || []).map((row: any) => {
        const cells = (row.children || []).map((cell: any) => {
          const cellRuns = buildRuns(cell.children || [], locale);
          return new TableCell({
            children:
              cellRuns.length > 0
                ? [new Paragraph({ children: cellRuns })]
                : [new Paragraph({ text: '' })],
            width: {
              size: 100 / (row.children?.length || 1),
              type: WidthType.PERCENTAGE,
            },
          });
        });
        return new TableRow({ children: cells });
      });
      return [new Table({ rows })];
    }

    case 'link': {
      const linkText =
        node.children?.map((c: any) => c.text || '').join('') || node.url || '';
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: linkText,
              color: '0563C1',
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
        }),
      ];
    }

    case 'image':
    case 'video':
    case 'audio': {
      try {
        const rawSrc = options.realUrl
          ? options.realUrl(node.src || node.URL || '')
          : node.src || node.URL || '';
        if (!rawSrc) return [];
        let buffer: Uint8Array;
        try {
          buffer = await fetchImageAsUint8Array(rawSrc);
        } catch {
          // 远程 URL 失败时尝试跨域转 PNG
          buffer = await fetchImageAsUint8Array(await convertToPng(rawSrc));
        }
        const { width, height } = await getImageDimensionsFromBuffer(buffer);
        return [
          new Paragraph({
            children: [
              new ImageRun({
                type: 'png',
                data: buffer,
                transformation: { width, height },
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ];
      } catch (e) {
        console.error('[docx] 图片处理失败:', e);
        return [
          new Paragraph({
            text: `[${t(locale, 'docxImage')}] ${node.src || ''}`,
          }),
        ];
      }
    }

    case 'equation': {
      const latex = node.texExpression || node.value || '';
      return [
        new Paragraph({
          children: [textRun(`$${latex}$$`, 0, 'font-family:Cambria;')],
          alignment: AlignmentType.CENTER,
        }),
      ];
    }

    case 'mermaid':
    case 'drawio':
    case 'mind':
    case 'excalidraw': {
      if (!options.renderCodeDiagram) {
        return [
          new Paragraph({ text: `[${node.type} ${t(locale, 'docxChart')}]` }),
        ];
      }
      try {
        const url = await options.renderCodeDiagram(
          node.type,
          node.data || node.code || '',
        );
        if (!url) return [new Paragraph({ text: `[${node.type}]` })];
        let buffer: Uint8Array;
        try {
          buffer = await fetchImageAsUint8Array(url);
        } catch {
          buffer = await fetchImageAsUint8Array(await convertToPng(url));
        }
        const { width, height } = await getImageDimensionsFromBuffer(buffer);
        return [
          new Paragraph({
            children: [
              new ImageRun({
                type: 'png',
                data: buffer,
                transformation: { width, height },
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ];
      } catch (e) {
        console.error('[docx] 图表渲染失败:', e);
        return [
          new Paragraph({ text: `[${node.type} ${t(locale, 'docxChart')}]` }),
        ];
      }
    }

    case 'callout': {
      const runs = buildRuns(node.children || [], locale);
      return [
        new Paragraph({
          children:
            runs.length > 0 ? runs : [new TextRun({ text: node.text || '' })],
          shading: { fill: 'F7F7F9', type: 'clear', color: 'auto' },
          border: {
            left: {
              color: normalizeDocxColor(node.color || '#3B82F6') || '3B82F6',
              size: 18,
              style: BorderStyle.SINGLE,
              space: 3,
            },
          },
        }),
      ];
    }

    default:
      // 递归处理带 children 的未知元素
      if (Array.isArray(node.children) && node.children.length > 0) {
        const results: DocxNode[] = [];
        for (const child of node.children) {
          results.push(...(await convertNodeToDocx(child, options)));
        }
        return results;
      }
      return [];
  }
}

/**
 * 将 Lexical 编辑器状态导出为 Word 文档并下载。
 */
export async function exportLexicalToDocx(
  editor: LexicalEditor,
  options: ExportOptions = {},
): Promise<void> {
  let lexicalJSONState: any;
  editor.getEditorState().read(() => {
    lexicalJSONState = editor.getEditorState().toJSON();
  });
  return exportLexicalValueToDocx(lexicalJSONState, options);
}

/**
 * 将 Lexical JSON State 导出为 Word 文档并下载。
 */
export async function exportLexicalValueToDocx(
  value: string | any,
  options: ExportOptions = {},
): Promise<void> {
  const payload =
    typeof value === 'string'
      ? JSON.parse(value)
      : deepCleanControlChars(value);

  if (!payload?.root) {
    throw new Error(t(options.locale ?? 'zh-CN', 'invalidLexicalData'));
  }

  const children: any[] = payload.root.children || [];
  const items: DocxNode[] = [];
  for (const node of children) {
    items.push(...(await convertNodeToDocx(node, options)));
  }

  const doc = new Document({
    sections: [
      {
        children: items as any[],
        properties: {},
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${options.title || 'document'}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 将多个 Lexical 值拼接为单个组合 state。 */
export function combineLexicalValues(values: (string | any)[]): any {
  const combinedState = {
    root: {
      children: [] as any[],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };

  if (!values || !Array.isArray(values)) return combinedState;

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (!val) continue;
    let parsedState = val;
    if (typeof val === 'string') {
      try {
        parsedState = JSON.parse(val);
      } catch {
        continue;
      }
    }
    const childrenNodes = parsedState?.root?.children;
    if (Array.isArray(childrenNodes)) {
      combinedState.root.children.push(...childrenNodes);
    }
  }
  return combinedState;
}
