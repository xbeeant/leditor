import { Editor } from '@leditor/lexical-editor';
import type { SerializedEditorState } from 'lexical';
import { useState } from 'react';
import { appid, token } from './constant';

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

export default function EditorBasic() {
  const [readOnly, setReadOnly] = useState(false);

  /**
   * 内容变化回调
   * onChange 接收序列化的 EditorState
   */
  const handleChange = (value: SerializedEditorState) => {
    console.log('编辑器内容变化:', value);
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          {readOnly ? '只读模式（工具栏已隐藏）' : '编辑模式'}
        </span>
        <button
          type="button"
          onClick={() => setReadOnly((v) => !v)}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          {readOnly ? '切换为编辑' : '切换为只读'}
        </button>
      </div>

      <Editor
        placeholder="Type something here..."
        onChange={handleChange}
        readOnly={readOnly}
        embed={embedConfig}
      />
    </div>
  );
}
