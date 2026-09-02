import { Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 代码块高亮示例
 * 展示代码块的插入和语法高亮
 */

const initialCodeValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '编辑器支持代码块插入和语法高亮，默认使用 Prism.js。',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

export default function CodeBlockExample() {
  const [activeTab, setActiveTab] = useState<
    'basic' | 'highlight' | 'readonly'
  >('basic');

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`rounded px-3 py-1 ${
            activeTab === 'basic'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          基础用法
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('highlight')}
          className={`rounded px-3 py-1 ${
            activeTab === 'highlight'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          代码高亮
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('readonly')}
          className={`rounded px-3 py-1 ${
            activeTab === 'readonly'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          只读模式
        </button>
      </div>

      {activeTab === 'basic' && (
        <div className="h-[600px]">
          <Editor
            placeholder="点击工具栏插入代码块..."
            initialValue={initialCodeValue}
          />
        </div>
      )}

      {activeTab === 'highlight' && (
        <div className="h-[600px]">
          <Editor
            placeholder="支持多种语言的语法高亮..."
            initialValue={initialCodeValue}
          />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <CodeBlockReadonlyExample />
        </div>
      )}
    </div>
  );
}

function CodeBlockReadonlyExample() {
  const [readOnly, setReadOnly] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          {readOnly ? '只读模式' : '编辑模式'}
        </span>
        <button
          type="button"
          onClick={() => setReadOnly((v) => !v)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          {readOnly ? '切换为编辑' : '切换为只读'}
        </button>
      </div>
      <Editor
        readOnly={readOnly}
        placeholder="只读模式下代码块以渲染态展示..."
        initialValue={initialCodeValue}
      />
    </div>
  );
}
