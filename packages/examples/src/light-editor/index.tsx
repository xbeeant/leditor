import { LightEditor } from '@leditor/lexical-editor';
import type { SerializedEditorState } from 'lexical';
import { useState } from 'react';

const initialValue = {
  root: {
    children: [
      {
        direction: 'ltr',
        format: 'h1',
        indent: 0,
        type: 'heading',
        version: 1,
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            type: 'text',
            version: 1,
            text: 'LightEditor 轻量级编辑器',
          },
        ],
      },
      {
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            type: 'text',
            version: 1,
            text: 'LightEditor 去除了工具栏、评论面板、目录等重型 UI 组件，',
          },
        ],
      },
      {
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            type: 'text',
            version: 1,
            text: '仅保留核心编辑能力和必要的插件扩展，适用于嵌入场景。',
          },
        ],
      },
      {
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            type: 'text',
            version: 1,
            text: '支持斜杠命令输入 / 快速插入区块，支持 Markdown 快捷键。',
          },
        ],
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

/**
 * 嵌入服务配置
 * - attachment: 附件上传/下载配置
 * - mind: 思维导图嵌入配置
 * - drawio: Draw.io 图表嵌入配置
 */
const embedConfig = {
  attachment: {
    action: `/attachment`,
    onDownload: (url: string) => {
      console.log('下载附件:', url);
    },
    getRealUrl: (url: string) => {
      return url;
    },
  },
  mind: {
    url: '/embed/mind',
    getRealUrl: (url: string) => {
      return url;
    },
    onRequest: async (url: string) => {
      const text = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${url}`, true);
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.responseText);
          } else {
            reject('');
          }
        };
        xhr.onerror = (e) => {
          console.error('网络错误', e);
        };
        xhr.send();
      });
      return text;
    },
  },
  drawio: {
    url: '/embed/drawio',
    getRealUrl: (url: string) => {
      return `${url}`;
    },
    onRequest: async (url: string) => {
      const text = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', `${url}`, true);
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.responseText);
          } else {
            reject('');
          }
        };
        xhr.onerror = (e) => {
          console.error('网络错误', e);
        };
        xhr.send();
      });
      return text;
    },
  },
};

/** LightEditor 使用示例 */
export default function LightEditorExample() {
  const [activeTab, setActiveTab] = useState<'basic' | 'markdown' | 'readonly'>(
    'basic',
  );

  const handleChange = (value: SerializedEditorState) => {
    console.log(value);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 模式切换 */}
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
          onClick={() => setActiveTab('markdown')}
          className={`rounded px-3 py-1 ${
            activeTab === 'markdown'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          Markdown 初始值
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

      {/* 编辑器 */}
      <div className="h-[600px]">
        {activeTab === 'basic' && (
          <LightEditor
            initialValue={initialValue}
            onChange={handleChange}
            placeholder="开始输入..."
            locale="zh-CN"
            embed={embedConfig}
            readOnly={false}
          />
        )}

        {activeTab === 'markdown' && (
          <LightEditor
            initialValue="# Markdown 示例\n\n这是 **Markdown** 格式初始化内容，支持：\n\n- 粗体\n- 斜体\n- 有序列表\n- 无序列表"
            onChange={handleChange}
            embed={embedConfig}
            placeholder="使用 Markdown 格式初始化..."
          />
        )}

        {activeTab === 'readonly' && (
          <LightEditor
            initialValue={initialValue}
            readOnly={true}
            embed={embedConfig}
            placeholder="只读模式..."
          />
        )}
      </div>

      {/* 使用说明 */}
      <div className="rounded bg-gray-50 p-4 text-sm text-gray-600">
        <h3 className="mb-2 font-semibold">使用说明</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>支持多种初始值格式：Lexical JSON、Markdown 字符串、Plate 数组</li>
          <li>onChange 回调接收序列化后的 EditorState（JSON）</li>
          <li>支持 readOnly 模式，隐藏所有交互控件</li>
          <li>可通过斜杠命令 / 快速插入标题、列表、表格等区块</li>
          <li>支持 Markdown 快捷键（**粗体**、*斜体* 等）</li>
        </ul>
      </div>
    </div>
  );
}
