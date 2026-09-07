import { CommentPanel, Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 评论系统示例
 * 展示评论面板的挂载、评论 API 对接、评论锚点等功能
 */

const initialCommentValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '评论系统示例文档',
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
        type: 'heading',
        version: 1,
      },
      {
        children: [
          {
            type: 'text',
            text: '选中编辑器中的文字可以添加评论。',
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
            text: '评论面板默认显示在右侧，可以通过工具栏按钮切换显隐。',
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
            text: '评论数据默认存储在 localStorage 中，可以通过 mockCommentsApi 进行模拟。',
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

export default function CommentExample() {
  const [activeTab, setActiveTab] = useState<
    'basic' | 'custom-api' | 'readonly'
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
          onClick={() => setActiveTab('custom-api')}
          className={`rounded px-3 py-1 ${
            activeTab === 'custom-api'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          自定义 API
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
            placeholder="选中文字添加评论..."
            initialValue={initialCommentValue}
          />
        </div>
      )}

      {activeTab === 'custom-api' && (
        <div className="h-[600px]">
          <CommentCustomApiExample />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <CommentReadonlyExample />
        </div>
      )}
    </div>
  );
}

/**
 * 使用 mockCommentsApi 的评论示例
 * 评论数据存储在 localStorage 中
 */
function CommentCustomApiExample() {
  const [showComments, setShowComments] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          评论面板：{showComments ? '显示' : '隐藏'}
        </span>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          {showComments ? '隐藏' : '显示'}
        </button>
      </div>
      <Editor
        placeholder="选中文字添加评论（数据存储在 localStorage）..."
        initialValue={initialCommentValue}
      />
      {showComments && <CommentPanel />}
    </div>
  );
}

/**
 * 只读模式下的评论示例
 */
function CommentReadonlyExample() {
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
        placeholder="只读模式下可查看评论但无法添加..."
        initialValue={initialCommentValue}
      />
    </div>
  );
}
