import {
  Editor,
  type EditorState,
  type LexicalEditor,
  exportLexicalToDocx,
  exportLexicalValueToDocx,
} from '@leditor/lexical-editor';
import type { SerializedEditorState } from 'lexical';
import { useRef, useState } from 'react';

/**
 * DOCX 导出示例
 * 展示如何将编辑器内容导出为 Word 文档
 */

const initialExportValue = {
  root: {
    children: [
      {
        children: [
          {
            type: 'text',
            text: '导出示例文档',
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
            text: '这是一个示例文档，可以用于导出测试。',
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
            text: '支持导出图片、表格、代码块、公式等内容到 Word 文档。',
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

export default function DocxExample() {
  const [activeTab, setActiveTab] = useState<'editor' | 'value'>('editor');
  const [exporting, setExporting] = useState(false);
  const [log, setLog] = useState<string>('');

  /**
   * 导出单个编辑器内容为 Word 文档
   * exportLexicalToDocx 接收 Editor 实例和导出选项
   */
  const handleExportFromEditor = async (editor: LexicalEditor | null) => {
    if (!editor) {
      setLog('请先初始化编辑器');
      return;
    }
    setExporting(true);
    setLog('');

    try {
      const options = {
        title: '导出文档',
        locale: 'zh-CN' as const,
      };

      await exportLexicalToDocx(editor, options);
      setLog('导出成功！文件已开始下载。');
    } catch (error) {
      setLog(
        `导出失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  /**
   * 从 JSON 值导出 Word
   * exportLexicalValueToDocx 接收 Lexical JSON 值和导出选项
   */
  const handleExportFromValue = async () => {
    setExporting(true);
    setLog('');

    try {
      const options = {
        title: '值导出文档',
        locale: 'zh-CN' as const,
      };

      await exportLexicalValueToDocx(initialExportValue, options);
      setLog('从值导出成功！文件已开始下载。');
    } catch (error) {
      setLog(
        `导出失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`rounded px-3 py-1 ${
            activeTab === 'editor'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          编辑器导出
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('value')}
          className={`rounded px-3 py-1 ${
            activeTab === 'value'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          值导出
        </button>
      </div>

      <div className="flex gap-2">
        {activeTab === 'editor' ? (
          <EditorWithExport
            exporting={exporting}
            onExport={handleExportFromEditor}
            log={log}
          />
        ) : (
          <div>
            <button
              type="button"
              onClick={handleExportFromValue}
              disabled={exporting}
              className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
            >
              {exporting ? '导出中...' : '导出为 Word'}
            </button>
            <p className="mt-2 text-sm text-gray-600">{log}</p>
            <pre className="mt-4 max-h-64 overflow-auto rounded bg-gray-100 p-4 text-xs">
              {JSON.stringify(initialExportValue, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 带导出功能的编辑器组件
 */
function EditorWithExport({
  exporting,
  onExport,
  log,
}: {
  exporting: boolean;
  onExport: (editor: LexicalEditor | null) => void;
  log: string;
}) {
  const editorRef = useRef<LexicalEditor | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onExport(editorRef.current)}
          disabled={exporting}
          className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
        >
          {exporting ? '导出中...' : '导出为 Word'}
        </button>
      </div>
      <p className="text-sm text-gray-600">{log}</p>
      <div className="h-[500px]">
        <EditorWithRef
          ref={editorRef}
          placeholder="输入内容后点击导出按钮..."
          initialValue={initialExportValue}
        />
      </div>
    </div>
  );
}

/**
 * 带 ref 的编辑器包装组件
 */
const EditorWithRef = ({
  ref,
  initialValue,
  placeholder,
  onChange,
}: {
  ref: React.Ref<LexicalEditor | null>;
  initialValue?: string;
  placeholder?: string;
  onChange?: (value: SerializedEditorState) => void;
}) => {
  return (
    <Editor
      ref={ref}
      initialValue={initialValue}
      placeholder={placeholder}
      onChange={onChange}
    />
  );
};
