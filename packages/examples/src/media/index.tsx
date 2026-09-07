import { Editor } from '@leditor/lexical-editor';
import { useState } from 'react';

/**
 * 媒体节点示例
 * 展示图片、视频、音频的插入和媒体上传配置
 */

/**
 * 媒体上传配置
 * uploadUrl: 上传接口地址，未配置则禁用上传
 * fieldName: 表单文件字段名，默认 'file'
 * urlKey: 响应中文件地址的字段键，支持 'a.b.c' 点路径，默认 'url'
 * headers: 额外请求头（如鉴权 Token）
 */
const mediaConfig = {
  uploadUrl: '/api/upload',
  fieldName: 'file',
  urlKey: 'url',
};

/**
 * 初始内容包含图片节点
 * 通过 Lexical JSON 格式预置图片内容
 */
const initialImageValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '编辑器支持图片节点，可以通过工具栏插入或使用 media 配置启用上传功能。',
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

export default function MediaExample() {
  const [activeTab, setActiveTab] = useState<'basic' | 'upload' | 'readonly'>(
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
          onClick={() => setActiveTab('upload')}
          className={`rounded px-3 py-1 ${
            activeTab === 'upload'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          上传配置
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
            placeholder="Type something here..."
            initialValue={initialImageValue}
            media={mediaConfig}
          />
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="h-[600px]">
          <Editor
            placeholder="配置 media.uploadUrl 后可以上传图片、视频、音频..."
            media={mediaConfig}
            onChange={(value) => {
              console.log('媒体节点变化:', value);
            }}
          />
        </div>
      )}

      {activeTab === 'readonly' && (
        <div className="h-[600px]">
          <MediaReadonlyExample />
        </div>
      )}
    </div>
  );
}

function MediaReadonlyExample() {
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
        placeholder="Type something here..."
        initialValue={initialImageValue}
        media={mediaConfig}
      />
    </div>
  );
}
