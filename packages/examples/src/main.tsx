import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import CalloutExample from './callout';
import CodeBlockExample from './codeblock';
import CommentExample from './comment';
import DocxExample from './docx';
// 基础示例
import EditorBasic from './editor-basic';
import EquationExample from './equation';
// 轻量级编辑器
import LightEditorExample from './light-editor';
// 功能示例
import MediaExample from './media';
import MermaidExample from './mermaid';
import RubyExample from './ruby';
import TableExample from './table';

// 差异对比
import { DiffEditor } from '@leditor/lexical-editor';

const diffCases = [
  {
    label: '文本修改',
    oldValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是一段旧文本。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是另一段旧内容。' }],
          },
        ],
      },
    },
    newValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是一段新文本。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是新增的段落。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是另一段旧内容。' }],
          },
        ],
      },
    },
  },
  {
    label: '段落增删',
    oldValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '第一段内容保持不变。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这段被删除了。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '最后一段。' }],
          },
        ],
      },
    },
    newValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '第一段内容保持不变。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '这是新增的段落。' }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '最后一段。' }],
          },
        ],
      },
    },
  },
  {
    label: '内容重写',
    oldValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: '欢迎使用旧版编辑器。' },
              { type: 'text', text: '这是一个示例。' },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '请阅读使用说明。' }],
          },
        ],
      },
    },
    newValue: {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: '欢迎使用新版编辑器。' },
              { type: 'text', text: '这是一个全新的示例。' },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: '请查看更新日志。' }],
          },
        ],
      },
    },
  },
];

/** 示例配置列表 */
const examples = [
  { id: 'basic', label: '基础用法' },
  { id: 'media', label: '媒体节点' },
  { id: 'table', label: '表格操作' },
  { id: 'equation', label: '公式' },
  { id: 'codeblock', label: '代码块' },
  { id: 'mermaid', label: 'Mermaid 图表' },
  { id: 'callout', label: '高亮标注' },
  { id: 'ruby', label: '注音' },
  { id: 'docx', label: 'DOCX 导出' },
  { id: 'comment', label: '评论系统' },
  { id: 'diff', label: '差异对比' },
  { id: 'light-editor', label: 'LightEditor' },
];

type ExampleId = (typeof examples)[number]['id'];

function renderExample(id: ExampleId) {
  switch (id) {
    case 'basic':
      return <EditorBasic />;
    case 'media':
      return <MediaExample />;
    case 'table':
      return <TableExample />;
    case 'equation':
      return <EquationExample />;
    case 'codeblock':
      return <CodeBlockExample />;
    case 'mermaid':
      return <MermaidExample />;
    case 'callout':
      return <CalloutExample />;
    case 'ruby':
      return <RubyExample />;
    case 'docx':
      return <DocxExample />;
    case 'comment':
      return <CommentExample />;
    case 'diff':
      return <DiffExample />;
    case 'light-editor':
      return <LightEditorExample />;
    default:
      return null;
  }
}

function DiffExample() {
  const [caseIndex, setCaseIndex] = useState(0);
  const currentCase = diffCases[caseIndex];

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">场景：</span>
        <select
          value={caseIndex}
          onChange={(e) => setCaseIndex(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700"
        >
          {diffCases.map((c, i) => (
            <option key={i} value={i}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1">
        <DiffEditor
          oldValue={currentCase.oldValue}
          newValue={currentCase.newValue}
        />
      </div>
    </div>
  );
}

function App() {
  const [activeId, setActiveId] = useState<ExampleId>('basic');

  return (
    <main className="mx-auto my-10 flex h-[calc(100vh-5rem)] flex-col p-4 font-sans">
      <h1 className="mb-4 text-2xl font-bold">leditor examples</h1>
      <p className="mb-4 text-sm text-gray-600">
        A Lexical-based rich text editor example. 共 {examples.length} 个示例。
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {examples.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveId(item.id as ExampleId)}
            className={`rounded-md px-3 py-1 text-sm ${
              activeId === item.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">{renderExample(activeId)}</div>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
