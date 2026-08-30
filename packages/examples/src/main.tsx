import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Editor } from '@leditor/lexical-editor';
import type { EditorState } from '@leditor/lexical-editor';

function App() {
  const [readOnly, setReadOnly] = useState(false);
  const handleChange = (state: EditorState) => {
    state.read(() => {
      const json = state.toJSON();
      console.log(json);
    });
  };

  return (
    <main className="mx-auto my-10 flex h-[calc(100vh-5rem)] flex-col p-4 font-sans">
      <h1 className="text-2xl font-bold">leditor examples</h1>
      <p className="text-gray-600">A Lexical-based rich text editor example.</p>
      <div className="mb-4 flex items-center gap-2">
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
      <div className="min-h-0 flex-1">
        <Editor
          placeholder="Type something here…"
          onChange={handleChange}
          readOnly={readOnly}
          onReadOnlyChange={setReadOnly}
        />
      </div>
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
