import { Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 注音 (Ruby) 示例
 * 展示注音/拼音节点的插入和渲染
 */

const initialRubyValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '编辑器支持注音/拼音功能，可以为文字添加标注。',
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
            text: '注音功能通过 Ruby 标签实现，',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
          {
            type: 'text',
            text: '编辑器',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
          {
            type: 'text',
            text: '可以通过工具栏按钮或斜杠命令插入。',
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

export default function RubyExample() {
  const [activeTab, setActiveTab] = useState<'basic' | 'readonly'>('basic');

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
            placeholder="点击工具栏插入注音节点..."
            initialValue={initialRubyValue}
          />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <RubyReadonlyExample />
        </div>
      )}
    </div>
  );
}

function RubyReadonlyExample() {
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
        placeholder="只读模式下注音以渲染态展示..."
        initialValue={initialRubyValue}
      />
    </div>
  );
}
