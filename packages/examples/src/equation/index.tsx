import { Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 公式节点示例
 * 展示公式的插入、行内/块级公式编辑
 */

const initialEquationValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '编辑器支持通过 KaTeX 渲染数学公式。',
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
      {
        children: [
          {
            type: 'text',
            text: '在工具栏点击"公式"按钮或使用斜杠命令 /equation 插入。',
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

export default function EquationExample() {
  const [activeTab, setActiveTab] = useState<'basic' | 'complex' | 'readonly'>(
    'basic',
  );

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
          onClick={() => setActiveTab('complex')}
          className={`rounded px-3 py-1 ${
            activeTab === 'complex'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          复杂公式
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
            placeholder="点击工具栏的公式按钮插入公式..."
            initialValue={initialEquationValue}
          />
        </div>
      )}

      {activeTab === 'complex' && (
        <div className="h-[600px]">
          <Editor
            placeholder="支持行内公式和块级公式..."
            initialValue={initialEquationValue}
          />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <EquationReadonlyExample />
        </div>
      )}
    </div>
  );
}

function EquationReadonlyExample() {
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
        placeholder="只读模式下公式以渲染态展示..."
        initialValue={initialEquationValue}
      />
    </div>
  );
}
