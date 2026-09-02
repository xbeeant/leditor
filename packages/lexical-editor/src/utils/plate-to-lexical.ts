// =============== 工具函数 ===============
type ConvertResult = {
  processChildren: boolean;
  node: Record<string, any>;
} | null;

function nodeStyle(node: Record<string, any>) {
  const style = [];

  if (node.fontSize) {
    style.push(`font-size: ${node.fontSize}`);
  }

  if (node.fontWeight) {
    style.push(`font-weight: ${node.fontWeight}`);
  }

  if (node.fontFamily) {
    style.push(`font-family: ${node.fontFamily}`);
  }

  if (node.backgroundColor) {
    style.push(`background-color: ${node.backgroundColor}`);
  }

  if (node.color) {
    style.push(`color: ${node.color}`);
  }
  return style;
}

function convertText(node: Record<string, any>): ConvertResult | null {
  const style: string[] = nodeStyle(node);
  const styleStr: string = style.length > 0 ? style.join(';') : '';

  if (node.text !== undefined) {
    let textContent = String(node.text || '');

    // =========================================================
    // 拦截：逃逸的 Draw.io 图表脏数据并使其突变为图表节点
    // =========================================================
    if (
      textContent.startsWith('%3CmxGraphModel') ||
      textContent.includes('mxGraphModel')
    ) {
      try {
        const decodedXml = textContent.startsWith('%')
          ? decodeURIComponent(textContent)
          : textContent;

        // 突变为 Drawio 节点，停止作为文本处理，避开 AutoLink 正则扫描
        return {
          processChildren: false,
          node: {
            type: 'drawio',
            version: 1,
            data: {
              xml: decodedXml, // 将 XML 源码安全地存入 data.xml
            },
            width: '100%',
            direction: null,
            format: '',
          },
        };
      } catch (error) {
        console.error('图表 XML 数据解析失败:', error);
        textContent = '【图表数据解析失败】'; // 安全降级
      }
    }

    // 无条件拦截所有超大文本，保护浏览器内核  任何超过 5000 字符的纯文本直接截断
    if (textContent.length > 5000) {
      console.warn('检测到异常超长文本，已触发强行截断保护');
      textContent = `${textContent.substring(0, 5000)}...(超长内容已截断)`;
    }

    // =========================================================
    // 正常文本组装逻辑
    // =========================================================
    const textNode: any = {
      type: 'text',
      version: 1,
      text: textContent,
      mode: 'normal',
      style: styleStr,
      detail: 0,
      format: 0,
    };

    if (node.bold) textNode.format |= 1;
    if (node.italic) textNode.format |= 2;
    if (node.strikethrough) textNode.format |= 4;
    if (node.underline) textNode.format |= 8;
    if (node.code) textNode.format |= 16;
    if (node.subscript) textNode.format |= 32;
    if (node.superscript) textNode.format |= 64;

    return {
      processChildren: false,
      node: textNode,
    };
  }

  return null;
}

function convertParagraph(node: Record<string, any>): ConvertResult {
  const orderedTypes: string[] = [
    'decimal',
    'lower-roman',
    'upper-roman',
    'lower-alpha',
    'upper-alpha',
  ];
  const unorderedTypes: string[] = ['disc', 'circle', 'square'];

  const isOrdered: boolean = orderedTypes.includes(node.listStyleType);
  const isUnordered: boolean = unorderedTypes.includes(node.listStyleType);

  // todo类型是任务列表
  const isTodo: boolean = node.listStyleType === 'todo';

  if (isOrdered || isUnordered || isTodo) {
    let list: ConvertResult;

    if (isOrdered) {
      list = convertOrderedList(node);
    } else if (isUnordered) {
      list = convertUnorderedList(node);
    } else {
      // 任务列表容器 (CheckList)
      list = {
        processChildren: true,
        node: {
          type: 'list',
          tag: 'ul',
          listType: 'check',
          direction: null,
          format: node.align,
          indent: 0,
        },
      };
    }

    if (list) {
      list.processChildren = false;
      if (node.children) {
        const listitemChildren: Record<string, any>[] = [];
        for (const item of node.children) {
          const result: Record<string, any> | null = slateToLexical(item, node);
          if (result) {
            listitemChildren.push(result);
          }
        }

        // 构建 listitem，并按需注入 checked 状态
        const listItemNode: Record<string, any> = {
          type: 'listitem',
          value: node.listStart || 1,
          indent: node.indent || 1, // 继承 Plate 的缩进深度
          children: listitemChildren,
        };

        if (isTodo) {
          listItemNode.checked = !!node.checked;
        }

        list.node.children = [listItemNode];
      }
    }

    return list;
  }

  // 默认段落处理
  const paragraphChildren: Record<string, any>[] = [];

  if (node.children && Array.isArray(node.children)) {
    const childrenArray = node.children;
    for (let i = 0; i < childrenArray.length; i++) {
      const child = childrenArray[i];
      const childResult = slateToLexical(child, node);
      if (childResult) {
        paragraphChildren.push(childResult);
      }

      if (
        (child.type === 'attachment' || child.type === 'file') &&
        i < childrenArray.length - 1
      ) {
        paragraphChildren.push({
          type: 'linebreak',
          version: 1,
        });
      }
    }
  }

  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);

  return {
    processChildren: false,
    node: {
      type: 'paragraph',
      version: 1,
      direction: null,
      format: node.align || '',
      indent: safeIndent,
      children: paragraphChildren,
    },
  };
}

function convertHeading(node: Record<string, any>): ConvertResult {
  const rawIndent = node.indent ?? 0;
  const safeIndent = Math.max(0, Number.parseInt(String(rawIndent), 10) || 0);

  return {
    processChildren: true,
    node: {
      type: 'heading',
      version: 1,
      tag: node.type,
      direction: null,
      format: node.align || '',
      indent: safeIndent,
    },
  };
}

function convertMind(
  node: Record<string, any>,
  parent?: Record<string, any>,
): ConvertResult {
  if (parent === undefined) {
    return {
      processChildren: false,
      node: {
        type: 'paragraph',
        direction: null,
        format: node.align,
        children: [
          {
            type: 'mind',
            data: {
              json: node.json,
              png: node.png,
            },
            width: node.width,
            direction: null,
            format: node.align,
          },
        ],
      },
    };
  }

  return {
    processChildren: false,
    node: {
      type: 'mind',
      data: {
        json: node.json,
        png: node.png,
      },
      width: node.width,
      direction: null,
      format: node.align,
    },
  };
}

function convertDrawio(
  node: Record<string, any>,
  parent?: Record<string, any>,
): ConvertResult {
  //src和svg同时存在，src是图，svg是xml
  const data = {} as any;
  if (node.src && node.svg) {
    data.src = node.src;
    data.svg = node.svg || node.xml;
  } else {
    data.svg = node.svg;
  }
  if (parent === undefined) {
    return {
      processChildren: false,
      node: {
        type: 'paragraph',
        direction: null,
        format: node.align,
        children: [
          {
            type: 'drawio',
            data,
            width: node.width,
            direction: null,
            format: node.align,
          },
        ],
      },
    };
  }

  return {
    processChildren: false,
    node: {
      type: 'drawio',
      data,
      width: node.width,
      direction: null,
      format: node.align,
    },
  };
}

function convertCodeblock(node: Record<string, any>): ConvertResult {
  const lines: Record<string, any>[] = [];
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);

  if (node.children) {
    for (const nodeItem of node.children) {
      for (const line of nodeItem.children) {
        const codeLine = slateToLexical(line, node);
        if (codeLine) {
          lines.push(codeLine);
          // 换行
          lines.push({ type: 'linebreak' });
        }
      }
    }
  }
  return {
    processChildren: false,
    node: {
      type: 'code',
      indent: safeIndent,
      language: node.lang,
      children: lines,
      direction: null,
      format: node.align,
    },
  };
}

function convertImg(node: Record<string, any>, parent?: any): ConvertResult {
  let captionBlockChildren: Record<string, any>[] = [];

  if (node.children && Array.isArray(node.children)) {
    const inlineOrTextNodes: Record<string, any>[] = [];

    for (const item of node.children) {
      // 1. 过滤掉 Slate Void 节点为了占位产生的无意义空文本
      if (item.text === '' && Object.keys(item).length === 1) continue;

      const rawResult = slateToLexical(item, node);
      if (rawResult) {
        // 2. 处理 slateToLexical 可能返回数组的防御逻辑
        const results = Array.isArray(rawResult) ? rawResult : [rawResult];

        for (const res of results) {
          // 分流：将内联节点拦截，避免直接暴露给 root 导致 Expected node root to have a parent
          if (res.type === 'text' || res.type === 'link') {
            inlineOrTextNodes.push(res);
          } else {
            captionBlockChildren.push(res);
          }
        }
      }
    }

    // 将收集到的游离内联节点合规地包裹在一个段落中
    if (inlineOrTextNodes.length > 0) {
      captionBlockChildren.push({
        type: 'paragraph',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: inlineOrTextNodes,
      });
    }
  }

  //  保证 Lexical 的 Nested EditorState 内至少存在一个 Block 节点
  if (captionBlockChildren.length === 0) {
    captionBlockChildren = [
      {
        type: 'paragraph',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: [],
      },
    ];
  }

  // 构建标准化的 Nested EditorState Root Context
  const captionEditorState = {
    editorState: {
      root: {
        type: 'root',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: captionBlockChildren,
      },
    },
  };

  //  严格按照原代码进行解构映射，确保各分支的 format 挂载位置一模一样
  if (parent === undefined) {
    return {
      processChildren: false,
      node: {
        type: 'paragraph',
        direction: null,
        format: node.align,
        children: [
          {
            type: 'image',
            showCaption: false,
            caption: captionEditorState,
            src: node.url,
            width: node.width || 0,
            height: node.height || 0,
            direction: null,
          },
        ],
      },
    };
  }

  // parent !== undefined 的情况
  return {
    processChildren: false,
    node: {
      type: 'image',
      showCaption: false,
      caption: captionEditorState,
      src: node.url,
      width: node.width || 0,
      height: node.height || 0,
      direction: null,
      format: node.align,
    },
  };
}

function convertUnorderedList(node: Record<string, any>): ConvertResult {
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);

  console.log('nodenode listStyleType', node, node.listStyleType);
  return {
    processChildren: true,
    node: {
      type: 'list',
      tag: 'ul',
      direction: null,
      listStyleType: node.listStyleType,
      format: node.align,
      indent: safeIndent,
      start: node.listStart || 1,
    },
  };
}

function convertOrderedList(node: Record<string, any>): ConvertResult {
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);

  return {
    processChildren: true,
    node: {
      type: 'enhanced-list',
      tag: 'ol',
      direction: null,
      listType: 'number',
      listStyleType: node.listStyleType || 'decimal',
      format: node.align,
      indent: safeIndent,
      start: node.listStart || 1,
    },
  };
}

function convertListItem(node: Record<string, any>): ConvertResult {
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);

  return {
    processChildren: true,
    node: {
      type: 'listitem',
      direction: null,
      format: node.align,
      value: 1,
      indent: safeIndent,
    },
  };
}

function convertBlockquote(node: Record<string, any>): ConvertResult {
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);
  return {
    processChildren: true,
    node: {
      indent: safeIndent,
      type: 'quote',
      direction: null,
      format: node.align,
    },
  };
}

function convertCodeBlock(node: Record<string, any>): ConvertResult {
  // Plate 的 code-block 通常子节点是单个 text 节点
  const content =
    node.children.length > 0 && node.children[0].text !== undefined
      ? node.children[0].text
      : '';

  return {
    processChildren: true,
    node: {
      type: 'code',
      children: [
        {
          type: 'text',
          text: content,
          detail: 0,
          format: 0,
        },
      ],
      direction: null,
      format: node.align,
      language: node.language || 'javascript',
    },
  };
}

function convertFile(node: Record<string, any>): ConvertResult {
  let url = node.url || '#';
  const displayText = node.name || '未命名文件';

  // realUrl
  const appid = '2022081700000000001';

  if (
    url.indexOf('appid') === -1 &&
    (url.indexOf('eoffice/api') !== -1 ||
      url.indexOf('feedback/api') !== -1 ||
      url.indexOf('manifest/api') !== -1 ||
      url.indexOf('filecloud/api') !== -1 ||
      url.indexOf('file/api') !== -1)
  ) {
    url = `${url}&appid=${appid}`;
  }

  return {
    processChildren: false,
    node: {
      type: 'link',
      version: 1,
      url: url,
      target: '_blank',
      rel: 'noopener noreferrer',
      direction: null,
      format: '',
      children: [
        {
          type: 'text',
          version: 1,
          text: displayText,
          mode: 'normal',
          style: '',
          detail: 0,
          format: 0,
        },
      ],
    },
  };
}

function convertAttachment(node: Record<string, any>): ConvertResult {
  let url = node.url || '#';
  const displayText = node.filename || '未命名附件';

  // realUrl
  const appid = '2022081700000000001';

  if (
    url.indexOf('appid') === -1 &&
    (url.indexOf('eoffice/api') !== -1 ||
      url.indexOf('feedback/api') !== -1 ||
      url.indexOf('manifest/api') !== -1 ||
      url.indexOf('filecloud/api') !== -1 ||
      url.indexOf('file/api') !== -1)
  ) {
    url = `${url}&appid=${appid}`;
  }

  return {
    processChildren: false,
    node: {
      type: 'link',
      // version必须，防止 Lexical 崩溃白屏
      version: 1,
      url: url,
      // 新窗口打开
      target: '_blank',
      rel: 'noopener noreferrer',
      direction: null,
      format: '',
      children: [
        {
          type: 'text',
          version: 1,
          text: displayText,
          mode: 'normal',
          style: '',
          detail: 0,
          format: 0,
        },
      ],
    },
  };
}

function convertLink(node: Record<string, any>): ConvertResult {
  // 1. 深度提取 URL，应对各种脏数据情况
  // 有的富文本叫 url，有的叫 href，有的甚至藏在 attributes 里
  const rawUrl = node.url || node.href || node.attributes?.href;

  // 2. 强制降级：Lexical 的 LinkNode 必须接收 string
  // 如果没有任何有效的 URL，赋予一个默认的锚点或空字符串，防止 sanitizeUrl 崩溃
  const safeUrl = typeof rawUrl === 'string' ? rawUrl : '#';

  return {
    processChildren: true,
    node: {
      direction: null,
      format: node.align,
      type: 'link',
      rel: 'noopener noreferrer',
      target: '_blank',
      title: null,
      url: safeUrl,
    },
  };
}

function convertSoaService(node: Record<string, any>): ConvertResult {
  return {
    processChildren: false,
    node: {
      type: 'paragraph',
      direction: null,
      format: node.align,
      children: [
        {
          direction: null,
          format: node.align,
          type: 'soa-service',
          data: node.value,
        },
      ],
    },
  };
}

// =============== 表格优化核心部分 ===============

// 辅助函数：从 Plate 的 table children 中提取所有有效的行节点 (tr / table_row)
// 并自动展平 tbody 等包裹容器，忽略任何非法节点（如 paragraph）
function extractTableRows(nodes: Record<string, any>[]): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (const child of nodes) {
    const type = child.type;
    if (type === 'tr' || type === 'table_row') {
      rows.push(child);
    } else if (type === 'tbody' || type === 'tfoot' || type === 'thead') {
      // 递归提取这些容器内的行
      if (Array.isArray(child.children)) {
        rows.push(...extractTableRows(child.children));
      }
    }
    // 其他类型（如 paragraph, div 等）直接忽略，确保 table 直接子节点只能是 tablerow
  }
  return rows;
}

// 优化后的 convertTable，确保直接子节点只能是 tablerow
function convertTable(node: Record<string, any>): ConvertResult {
  // 1. 提取所有有效的行节点（自动展平 tbody 等，过滤非法节点）
  const rawChildren =
    node.children && Array.isArray(node.children) ? node.children : [];
  const rowNodes = extractTableRows(rawChildren);

  // 2. 手动转换每个行节点为 Lexical 的 tablerow
  const lexicalRows: Record<string, any>[] = [];
  for (const rowNode of rowNodes) {
    // 使用 slateToLexical 递归转换行节点，此时 processChildren 由 convertTr 自己控制
    const converted = slateToLexical(rowNode, undefined);
    if (converted && converted.type === 'tablerow') {
      lexicalRows.push(converted);
    } else if (converted) {
      // 理论上 convertTr 一定会返回 type: 'tablerow'，但若出现异常，记录警告
      console.warn('期待 tablerow 但得到了', converted.type, converted);
    }
  }

  // 3. 确保至少有一个空行，避免 Lexical 渲染异常
  if (lexicalRows.length === 0) {
    lexicalRows.push({
      type: 'tablerow',
      children: [], // convertTr 会保证至少有一个空单元格，这里只需占位
    });
  }

  // 4. 返回处理完成的 table 节点，禁用通用递归处理原始 children
  return {
    processChildren: false,
    node: {
      direction: null,
      format: node.align,
      type: 'table',
      children: lexicalRows,
    },
  };
}

// 转换表格行 (TR)
function convertTr(node: Record<string, any>): ConvertResult {
  if (Array.isArray(node.children)) {
    node.children = node.children.filter((child: any) => {
      const isCell =
        child.type === 'td' ||
        child.type === 'th' ||
        child.type === 'table_cell';

      if (!isCell) {
        console.warn('在 TR 中发现了非 TD 节点并已剔除', child);
      }
      return isCell;
    });
  }

  if (node.children && node.children.length === 0) {
    node.children.push({ type: 'td', children: [{ text: '' }] });
  }

  return {
    processChildren: true,
    node: {
      type: 'tablerow',
      // 行高
      height: node.height || extractHeightFromStyle(node.style),
      style: node.style || undefined,
    },
  };
}

// 处理td，th
export function convertTableCell(node: Record<string, any>): ConvertResult {
  const rawColSpan: any =
    node.attributes?.colspan || node.attributes?.colSpan || node.colSpan;
  const rawRowSpan: any =
    node.attributes?.rowspan || node.attributes?.rowSpan || node.rowSpan;
  const colSpan: number = Number.parseInt(String(rawColSpan), 10) || 1;
  const rowSpan: number = Number.parseInt(String(rawRowSpan), 10) || 1;
  const extractedBgColor: any =
    node.backgroundColor ||
    node.background ||
    node.attributes?.backgroundColor ||
    node.attributes?.background ||
    null;

  // 1. 初始化 Lexical 的 TableCell 骨架
  const lexicalCell = {
    type: 'tablecell',
    colSpan: colSpan,
    rowSpan: rowSpan,
    headerState: node.type === 'th' ? 1 : 0,
    backgroundColor: extractedBgColor,
    width: node.width ? Number.parseInt(node.width, 10) : undefined,
    direction: null,
    format: node.align || '',
    children: [] as any[], // 等待我们清洗后注入
  };

  // 2. 接管并清洗子节点 (AST Normalizing)
  const normalizedChildren: any[] = [];

  if (node.children && Array.isArray(node.children)) {
    let inlineAccumulator: any[] = [];

    // 闭包函数：将堆积的 inline 节点打包成合规的 Paragraph
    const flushInlines = () => {
      if (inlineAccumulator.length > 0) {
        normalizedChildren.push({
          type: 'paragraph',
          version: 1,
          direction: null,
          format: '',
          indent: 0,
          children: inlineAccumulator,
        });
        inlineAccumulator = []; // 清空游标
      }
    };

    for (const plateChild of node.children) {
      const lexicalResult = slateToLexical(plateChild);
      if (!lexicalResult) continue;

      const lexicalChildren = Array.isArray(lexicalResult)
        ? lexicalResult
        : [lexicalResult];

      for (const lexicalChild of lexicalChildren) {
        if (!lexicalChild) continue;

        const isBlockNode = [
          'paragraph',
          'list',
          'listitem',
          'heading',
          'quote',
          'code',
          'drawio',
        ].includes(lexicalChild.type);

        if (isBlockNode) {
          flushInlines();
          normalizedChildren.push(lexicalChild);
        } else {
          inlineAccumulator.push(lexicalChild);
        }
      }
    }

    flushInlines();
  }

  if (normalizedChildren.length === 0) {
    normalizedChildren.push({
      type: 'paragraph',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [],
    });
  }

  lexicalCell.children = normalizedChildren;

  return {
    processChildren: false,
    node: lexicalCell,
  };
}

// 从style字符串中提取高度
function extractHeightFromStyle(styleStr?: string): number | undefined {
  if (!styleStr) return undefined;
  const match = styleStr.match(/height:\s*(\d+)px/);
  return match ? Number(match[1]) : undefined;
}

function convertCallout(node: Record<string, any>): ConvertResult {
  const safeIndent = Math.max(0, Number.parseInt(String(node.indent), 10) || 0);
  return {
    processChildren: true,
    node: {
      indent: safeIndent,
      type: 'callout', // 必须和 CalloutNode 里的 getType() 对应
      icon: node.icon || '[灯泡]', // 提取图标，给个默认值
      // 如果需要，也可以提取 backgroundColor 等属性传进去
    },
  };
}

// =============== 转换调度映射 ===============

const ELEMENT_CONVERTERS: Record<
  string,
  (node: Record<string, any>, parent?: Record<string, any>) => ConvertResult
> = {
  a: convertLink,
  link: convertLink,
  attachment: convertAttachment,
  file: convertFile,
  'soa-service': convertSoaService,
  drawio: convertDrawio,
  table: convertTable, // 使用优化后的 table 转换器
  td: convertTableCell,
  th: convertTableCell,
  tr: convertTr,
  callout: convertCallout,
  p: convertParagraph,
  h1: convertHeading,
  h2: convertHeading,
  h3: convertHeading,
  h4: convertHeading,
  h5: convertHeading,
  h6: convertHeading,
  img: convertImg,
  'img-inline': convertImg,
  code_block: convertCodeblock,
  ul: convertUnorderedList,
  ol: convertOrderedList,
  li: convertListItem,
  mind: convertMind,
  blockquote: convertBlockquote,
  'code-block': convertCodeBlock,
};

// =============== 递归转换主函数 ===============

function slateToLexical(
  plateNode: Record<string, any>,
  lexicalNode?: Record<string, any>,
): Record<string, any> | null {
  let result: ConvertResult;
  // 文本节点（叶子）
  if (plateNode.text !== undefined) {
    result = convertText(plateNode);
  } else {
    const converter = ELEMENT_CONVERTERS[plateNode.type];
    if (converter) {
      result = converter(plateNode, lexicalNode);
    } else {
      // 未知类型：降级为 paragraph（或可抛出警告）
      console.warn(`Unknown node type: ${plateNode.type}`, plateNode);
      result = convertParagraph(plateNode);
    }
  }

  if (result) {
    if (result.processChildren) {
      if (plateNode.children && plateNode.children.length > 0) {
        // 递归处理子节点
        const children: Record<string, any>[] = [];

        for (const item of plateNode.children) {
          const node = slateToLexical(item, result);
          if (node) {
            children.push(node);
          }
        }
        if (null === result.node) {
          return children;
        }

        if (children) {
          result.node.children = children;
        }
      }
    }

    if (plateNode.id) {
      result.node.ids = [plateNode.id];
    }

    return result.node;
  }

  return null;
}

function blockquotePreConvert(node: Record<string, any>) {
  if (!node.children || !Array.isArray(node.children)) {
    return node;
  }

  // 2. 展平 (Flatten) 内部的 paragraph 结构
  const flattenedChildren = node.children.flatMap(
    (child: any, index: number) => {
      const isParagraph = child.type === 'p' || child.type === 'paragraph';

      if (isParagraph) {
        const extractedChildren = child.children || [];

        // 【可选架构优化】处理多段落换行：
        // 如果一个 quote 内有多个 p，直接合并会导致文本粘连。
        // 可以在非首个且有内容的段落前，强行插入一个换行节点。
        if (index > 0 && extractedChildren.length > 0) {
          // 注意：这里插入的结构需与你 slateToLexical 支持的换行节点匹配
          return [{ type: 'linebreak' }, ...extractedChildren];
        }

        return extractedChildren;
      }

      // 非 paragraph 节点（如直接嵌套的 text）保持原样
      return child;
    },
  );

  // 3. 返回清洗后的节点副本，保持 Immutable 数据流
  return {
    ...node,
    children: flattenedChildren,
  };
}

/**
 * AST 预处理器：负责在进入 Lexical 转换核心前，清洗和展平 Plate 的异构数据
 */
function normalizePlateAST(
  nodes: Record<string, any>[],
): Record<string, any>[] {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node) => {
    // 1. 拦截特定类型 (兼容 quote 和 blockquote)
    if (node.type === 'quote' || node.type === 'blockquote') {
      return blockquotePreConvert(node);
    }

    if (node.children && Array.isArray(node.children)) {
      return {
        ...node,
        children: normalizePlateAST(node.children),
      };
    }
    return node;
  });
}

export function plateToLexical(plateNodes: Record<string, any>[]) {
  if (!Array.isArray(plateNodes)) {
    throw new Error('Input must be an array of Plate nodes');
  }

  // 先进行第一次遍历，将有的嵌套了一层多余p的去掉p这一层，直接将p.children(node.p.children)提取到node层级
  const normalizedNodes = normalizePlateAST(plateNodes);

  let lexicalChildren = normalizedNodes
    .map((item) => slateToLexical(item, undefined))
    .filter(Boolean);

  // Lexical 的 root 节点内部不能没有任何 block 节点
  if (lexicalChildren.length === 0) {
    lexicalChildren = [
      {
        type: 'paragraph',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ];
  }

  const root = {
    root: {
      type: 'root',
      children: lexicalChildren,
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  };

  console.log('最终转换结果:', root, JSON.stringify(root));
  return root;
}
