import { $createCodeNode, $isCodeNode } from '@lexical/code-core';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  type ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Image as ImageIcon,
  Indent,
  Italic,
  Link as LinkIcon,
  Minus,
  Outdent,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INSERT_IMAGE_COMMAND } from './commands';

const FONT_FAMILIES = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Helvetica',
  'System UI',
];

const FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 64, 72,
];

const TEXT_COLORS = [
  '#000000',
  '#e03e3e',
  '#e8728c',
  '#d8943a',
  '#aa8b28',
  '#4ea24b',
  '#368b8b',
  '#3b8ed0',
  '#6c5cd6',
  '#8b54b3',
  '#ffffff',
  '#9b9b9b',
];

const BG_COLORS = [
  '#ffffff',
  '#fbd9d9',
  '#fce2c8',
  '#fbf4c4',
  '#d9f0d3',
  '#cfeeee',
  '#d6e4f7',
  '#e3def7',
  '#f0e0f3',
  '#d9d9d9',
  'transparent',
];

const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'json',
  'bash',
  'css',
  'markup',
  'plaintext',
];

type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'bullet'
  | 'number'
  | 'check'
  | 'quote'
  | 'code';

const btn =
  'inline-flex h-8 min-w-8 items-center justify-center rounded border border-transparent px-2 text-sm hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent';
const btnActive = 'bg-blue-100 border-blue-400';
const sep = 'mx-1 h-6 w-px bg-gray-200';

export function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('');
  const [fontColor, setFontColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('transparent');
  const [activeAlign, setActiveAlign] = useState('left');
  const [isRTL, setIsRTL] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    subscript: false,
    superscript: false,
    code: false,
    link: false,
  });
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    const anchorNode = selection.anchor.getNode();

    setFormats({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      subscript: selection.hasFormat('subscript'),
      superscript: selection.hasFormat('superscript'),
      code: selection.hasFormat('code'),
      link:
        $isLinkNode(anchorNode) ||
        anchorNode.getParents().some((n) => $isLinkNode(n)),
    });

    const topLevel =
      anchorNode.getKey() === 'root'
        ? anchorNode
        : anchorNode.getTopLevelElementOrThrow();
    const element = topLevel as ElementNode;

    if ($isListNode(element)) {
      const listType = element.getListType();
      setBlockType(
        listType === 'bullet'
          ? 'bullet'
          : listType === 'number'
            ? 'number'
            : 'check',
      );
    } else if ($isHeadingNode(element)) {
      setBlockType(element.getTag() as BlockType);
    } else if ($isQuoteNode(element)) {
      setBlockType('quote');
    } else if ($isCodeNode(element)) {
      setBlockType('code');
      setCodeLanguage(
        (
          element as unknown as { getLanguage?: () => string }
        ).getLanguage?.() ?? 'javascript',
      );
    } else {
      setBlockType('paragraph');
    }

    const style = element.getStyle?.() ?? '';
    setFontFamily(style.match(/font-family:\s*([^;]+)/i)?.[1]?.trim() ?? '');
    setFontSize(style.match(/font-size:\s*([^;]+)/i)?.[1]?.trim() ?? '');
    setFontColor(style.match(/color:\s*([^;]+)/i)?.[1]?.trim() ?? '#000000');
    setBgColor(
      style.match(/background-color:\s*([^;]+)/i)?.[1]?.trim() ?? 'transparent',
    );
    const formatType = element.getFormatType?.() ?? '';
    setActiveAlign(formatType || 'left');
    setIsRTL(element.getDirection?.() === 'rtl');
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(updateToolbar);
    });
  }, [editor, updateToolbar]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor]);

  const applyBlockType = (value: BlockType) => {
    if (value === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (value === 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (value === 'check') {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      return;
    }
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (value === 'paragraph') {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (value === 'quote') {
        $setBlocksType(selection, () => $createQuoteNode());
      } else if (value === 'code') {
        $setBlocksType(selection, () => $createCodeNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(value));
      }
    });
  };

  const applyFontFamily = (family: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-family': family || '' });
      }
    });
  };

  const applyFontSize = (size: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': size ? `${size}px` : '' });
      }
    });
  };

  const applyColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
    setFontColor(color);
  };

  const applyBgColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': color });
      }
    });
    setBgColor(color);
  };

  const applyAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align);
    setActiveAlign(align);
  };

  const toggleLink = () => {
    editor.getEditorState().read(
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const node = selection.anchor.getNode();
        if (
          $isLinkNode(node) ||
          node.getParents().some((n) => $isLinkNode(n))
        ) {
          setLinkUrl('');
          setLinkEditorOpen(true);
          return;
        }
        const linkParent = node.getParents().find((n) => $isLinkNode(n));
        if (linkParent) {
          setLinkUrl(linkParent.getURL());
        } else {
          setLinkUrl('');
        }
        setLinkEditorOpen(true);
      },
      { editor },
    );
  };

  const commitLink = () => {
    const url = linkUrl.trim();
    if (url === '') {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    }
    setLinkEditorOpen(false);
    editor.focus();
  };

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: '3',
      rows: '3',
    });
  };

  const insertImage = () => {
    const src = window.prompt('Image URL');
    if (!src) return;
    const altText = window.prompt('Alt text', '') ?? '';
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, { src, altText });
  };

  const applyCodeLanguage = (language: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const top = selection.anchor.getNode().getTopLevelElementOrThrow();
        if ($isCodeNode(top)) top.setLanguage(language);
      }
    });
    setCodeLanguage(language);
  };

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-white/95 p-2 backdrop-blur"
    >
      <button
        type="button"
        className={btn}
        disabled={!canUndo}
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        title="Undo"
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        className={btn}
        disabled={!canRedo}
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        title="Redo"
      >
        <Redo2 size={18} />
      </button>

      <span className={sep} />

      <select
        className="h-8 rounded border border-gray-300 bg-white px-1 text-sm"
        value={blockType}
        onChange={(e) => applyBlockType(e.target.value as BlockType)}
        title="Paragraph style"
      >
        <option value="paragraph">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="quote">Quote</option>
        <option value="code">Code block</option>
        <option value="bullet">Bulleted list</option>
        <option value="number">Numbered list</option>
        <option value="check">Check list</option>
      </select>

      {blockType === 'code' && (
        <select
          className="h-8 rounded border border-gray-300 bg-white px-1 text-sm"
          value={codeLanguage}
          onChange={(e) => applyCodeLanguage(e.target.value)}
          title="Code language"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}

      <span className={sep} />

      <select
        className="h-8 rounded border border-gray-300 bg-white px-1 text-sm"
        value={fontFamily}
        onChange={(e) => applyFontFamily(e.target.value)}
        title="Font family"
      >
        <option value="">Default</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        className="h-8 w-16 rounded border border-gray-300 bg-white px-1 text-sm"
        value={fontSize}
        onChange={(e) => applyFontSize(e.target.value)}
        title="Font size"
      >
        <option value="">–</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <span className={sep} />

      <button
        type="button"
        className={`${btn} font-bold ${formats.bold ? btnActive : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.italic ? btnActive : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.underline ? btnActive : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline"
      >
        <Underline size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.strikethrough ? btnActive : ''}`}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }
        title="Strikethrough"
      >
        <Strikethrough size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.subscript ? btnActive : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')}
        title="Subscript"
      >
        <Subscript size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.superscript ? btnActive : ''}`}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')
        }
        title="Superscript"
      >
        <Superscript size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${formats.code ? btnActive : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        title="Inline code"
      >
        <Code size={18} />
      </button>

      <span className={sep} />

      <ColorButton
        label="Text color"
        color={fontColor === 'transparent' ? '#000000' : fontColor}
        colors={TEXT_COLORS}
        onChange={applyColor}
      />
      <ColorButton
        label="Highlight"
        color={bgColor === 'transparent' ? '#ffffff' : bgColor}
        colors={BG_COLORS}
        onChange={applyBgColor}
      />

      <button
        type="button"
        className={`${btn} ${formats.link ? btnActive : ''}`}
        onClick={toggleLink}
        title="Insert link"
      >
        <LinkIcon size={18} />
      </button>

      {linkEditorOpen && (
        <div className="absolute left-2 top-12 flex items-center gap-1 rounded border border-gray-300 bg-white p-2 shadow-lg">
          <input
            autoFocus
            className="h-8 w-64 rounded border border-gray-300 px-2 text-sm"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLink();
              if (e.key === 'Escape') setLinkEditorOpen(false);
            }}
          />
          <button
            type="button"
            className="h-8 rounded bg-blue-600 px-3 text-sm text-white"
            onClick={commitLink}
          >
            Apply
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setLinkEditorOpen(false)}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <span className={sep} />

      <button
        type="button"
        className={`${btn} ${activeAlign === 'left' ? btnActive : ''}`}
        onClick={() => applyAlign('left')}
        title="Align left"
      >
        <AlignLeft size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${activeAlign === 'center' ? btnActive : ''}`}
        onClick={() => applyAlign('center')}
        title="Align center"
      >
        <AlignCenter size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${activeAlign === 'right' ? btnActive : ''}`}
        onClick={() => applyAlign('right')}
        title="Align right"
      >
        <AlignRight size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${activeAlign === 'justify' ? btnActive : ''}`}
        onClick={() => applyAlign('justify')}
        title="Justify"
      >
        <AlignJustify size={18} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)
        }
        title="Outdent"
      >
        <Outdent size={18} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)
        }
        title="Indent"
      >
        <Indent size={18} />
      </button>
      <button
        type="button"
        className={`${btn} ${isRTL ? btnActive : ''}`}
        onClick={() => {
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              const top = sel.anchor.getNode().getTopLevelElementOrThrow();
              top.setDirection(isRTL ? 'ltr' : 'rtl');
            }
          });
        }}
        title="Right-to-left"
      >
        RTL
      </button>

      <span className={sep} />

      <button
        type="button"
        className={btn}
        onClick={insertTable}
        title="Insert table"
      >
        <TableIcon size={18} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
        }
        title="Insert divider"
      >
        <Minus size={18} />
      </button>
      <button
        type="button"
        className={btn}
        onClick={insertImage}
        title="Insert image"
      >
        <ImageIcon size={18} />
      </button>

      <span className={sep} />

      <button
        type="button"
        className={btn}
        onClick={() => {
          editor.update(() => {
            const sel = $getSelection();
            if ($isRangeSelection(sel)) {
              $patchStyleText(sel, {
                color: '',
                'background-color': '',
                'font-size': '',
                'font-family': '',
              });
            }
          });
        }}
        title="Clear formatting"
      >
        <Eraser size={18} />
      </button>
    </div>
  );
}

interface ColorButtonProps {
  label: string;
  color: string;
  colors: string[];
  onChange: (color: string) => void;
}

function ColorButton({ label, color, colors, onChange }: ColorButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={btn}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="inline-block h-4 w-4 rounded border border-gray-300"
          style={{ backgroundColor: color }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-20 grid w-40 grid-cols-5 gap-1 rounded border border-gray-300 bg-white p-2 shadow-lg">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className="h-6 w-6 rounded border border-gray-200"
              style={{ backgroundColor: c }}
              title={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <label className="col-span-5 mt-1 flex items-center gap-1 text-xs text-gray-500">
            <input
              type="color"
              className="h-6 w-8 cursor-pointer"
              onChange={(e) => onChange(e.target.value)}
            />
            Custom
          </label>
        </div>
      )}
    </div>
  );
}
