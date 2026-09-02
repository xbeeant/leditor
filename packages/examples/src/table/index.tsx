import { Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 表格操作增强示例
 * 展示表格插入、列宽调整、Excel 粘贴、操作菜单等功能
 */

const initialTableValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '编辑器内置了丰富的表格功能：',
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
            text: '1. 通过工具栏插入表格，支持自定义行列数',
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
            text: '2. 鼠标拖拽列边界调整列宽',
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
            text: '3. 右键点击表格可查看操作菜单（插入/删除行列等）',
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
            text: '4. 支持从 Excel 直接粘贴表格，保留格式',
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
            text: '5. 表格滚动时会自动显示阴影效果提示可滚动',
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
            text: '6. 支持在表格内拖拽选择多个单元格',
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

export default function TableExample() {
  const [activeTab, setActiveTab] = useState<'basic' | 'excel' | 'readonly'>(
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
          onClick={() => setActiveTab('excel')}
          className={`rounded px-3 py-1 ${
            activeTab === 'excel'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          Excel 粘贴
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
            placeholder="点击工具栏的表格按钮插入表格..."
            initialValue={initialTableValue}
          />
        </div>
      )}

      {activeTab === 'excel' && (
        <div className="h-[600px]">
          <Editor
            placeholder="复制 Excel 表格后粘贴到编辑器中..."
            initialValue={initialTableValue}
          />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <TableReadonlyExample />
        </div>
      )}
    </div>
  );
}

function TableReadonlyExample() {
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
        placeholder="只读模式下表格不可编辑..."
        initialValue={initialTableValue}
      />
    </div>
  );
}
