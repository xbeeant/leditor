import { $isCodeNode } from '@lexical/code-core';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $getNearestNodeFromDOMNode, $getNodeByKey } from 'lexical';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CODE_LANGUAGES = [
  // Web
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'html',
  'css',
  'scss',
  'less',
  // 后端
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'perl',
  'scala',
  'r',
  // 脚本
  'bash',
  'powershell',
  // 数据格式
  'json',
  'yaml',
  'sql',
  'graphql',
  'markdown',
  // 配置
  'docker',
  'git',
  'makefile',
  'toml',
  'ini',
];

interface CodeBlockToolbarProps {
  codeNodeKey: string;
  codeElement: HTMLElement;
  onClose: () => void;
}

function CodeBlockToolbar({
  codeNodeKey,
  codeElement,
  onClose,
}: CodeBlockToolbarProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [language, setLanguage] = useState('javascript');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const node = $getNodeByKey(codeNodeKey);
        if ($isCodeNode(node)) {
          setLanguage(node.getLanguage() ?? 'javascript');
        }
      });
    });
  }, [editor, codeNodeKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        languageMenuRef.current &&
        !languageMenuRef.current.contains(event.target as Node)
      ) {
        setShowLanguageMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (newLanguage: string) => {
    editor.update(() => {
      const node = $getNodeByKey(codeNodeKey);
      if ($isCodeNode(node)) {
        node.setLanguage(newLanguage);
      }
    });
    setLanguage(newLanguage);
    setShowLanguageMenu(false);
  };

  const handleCopy = useCallback(async () => {
    let text = '';
    editor.read(() => {
      const node = $getNodeByKey(codeNodeKey);
      if ($isCodeNode(node)) {
        text = node.getTextContent();
      }
    });
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  }, [editor, codeNodeKey]);

  const codeRect = codeElement.getBoundingClientRect();

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-md border border-gray-200 bg-white/95 px-2 py-1 shadow-md backdrop-blur-sm"
      style={{
        right: window.innerWidth - codeRect.right + 8,
        top: codeRect.top + 4,
      }}
      onMouseEnter={() => {}}
      onMouseLeave={() => onClose()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="relative" ref={languageMenuRef}>
        <button
          type="button"
          onClick={() => setShowLanguageMenu((v) => !v)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span>{language}</span>
          <ChevronDown size={10} />
        </button>

        {showLanguageMenu && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="max-h-60 overflow-y-auto">
              {CODE_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguageChange(lang)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-100 ${
                    lang === language
                      ? 'font-medium text-blue-600'
                      : 'text-gray-700'
                  }`}
                >
                  <span>{lang}</span>
                  {lang === language && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-3 w-px bg-gray-200" />

      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        title={copied ? '已复制' : '复制代码'}
      >
        {copied ? (
          <Check size={12} className="text-green-600" />
        ) : (
          <Copy size={12} />
        )}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
    </div>
  );
}

export function CodeBlockPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const [hoveredCode, setHoveredCode] = useState<{
    key: string;
    element: HTMLElement;
  } | null>(null);

  useEffect(() => {
    if (!isEditable) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target || !target.closest) return;

      const codeElement = target.closest<HTMLElement>(
        'code[class*="font-mono"]',
      );
      if (!codeElement) return;

      const root = editor.getRootElement();
      if (!root || !root.contains(codeElement)) return;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      editor.getEditorState().read(
        () => {
          const node = $getNearestNodeFromDOMNode(codeElement);
          if ($isCodeNode(node)) {
            setHoveredCode({ key: node.getKey(), element: codeElement });
          }
        },
        { editor },
      );
    };

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.relatedTarget as HTMLElement;
      if (!target) return;

      if (
        target instanceof HTMLElement &&
        (target.closest('[data-code-block-toolbar]') ||
          target.closest('code[class*="font-mono"]'))
      ) {
        return;
      }

      timeoutId = setTimeout(() => {
        setHoveredCode(null);
      }, 100);
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor, isEditable]);

  if (!isEditable || !hoveredCode) {
    return null;
  }

  return createPortal(
    <div data-code-block-toolbar>
      <CodeBlockToolbar
        codeNodeKey={hoveredCode.key}
        codeElement={hoveredCode.element}
        onClose={() => setHoveredCode(null)}
      />
    </div>,
    document.body,
  );
}
