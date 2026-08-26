import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Editor } from '@leditor/lexical-editor';
import type { EditorState } from '@leditor/lexical-editor';

function App() {
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
      <div className="min-h-0 flex-1">
        <Editor placeholder="Type something here…" onChange={handleChange} />
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
