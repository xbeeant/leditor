import {
  $createCodeHighlightNode,
  $isCodeNode,
  type CodeNode,
} from '@lexical/code-core';
import { defineExtension } from 'lexical';
import {
  $createLineBreakNode,
  $getNodeByKey,
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  type LexicalNode,
  type TextNode,
} from 'lexical';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';

const ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  html: 'markup',
  xml: 'markup',
  yml: 'yaml',
  zsh: 'bash',
};

function getGrammar(language: string | null | undefined) {
  const lang = (language ?? 'javascript').toLowerCase();
  if (lang === 'plaintext' || lang === 'text') return null;
  const resolved = ALIASES[lang] ?? lang;
  return (
    (Prism.languages[resolved] as object | undefined) ??
    (Prism.languages.javascript as object | undefined)
  );
}

function tokenText(token: unknown): string {
  if (typeof token === 'string') return token;
  if (token && typeof token === 'object' && 'content' in token) {
    const content = (token as { content: unknown }).content;
    if (Array.isArray(content)) return content.map(tokenText).join('');
    return tokenText(content);
  }
  return '';
}

function tokenType(token: unknown): string | null {
  if (token && typeof token === 'object' && 'type' in token) {
    const t = token as { type: string; alias?: string | string[] };
    if (t.alias) {
      return Array.isArray(t.alias) ? t.alias[0] : t.alias;
    }
    return t.type;
  }
  return null;
}

function $tokenizeCode(codeNode: CodeNode) {
  const grammar = getGrammar(codeNode.getLanguage());
  const text = codeNode.getTextContent();
  const lines = text.split('\n');
  const newNodes: LexicalNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length > 0) {
      if (grammar) {
        const tokens = Prism.tokenize(line, grammar) as unknown[];
        for (const token of tokens) {
          const type = tokenType(token);
          const content = tokenText(token);
          if (content.length > 0) {
            newNodes.push($createCodeHighlightNode(content, type));
          }
        }
      } else {
        newNodes.push($createCodeHighlightNode(line, null));
      }
    }
    if (index < lines.length - 1) {
      newNodes.push($createLineBreakNode());
    }
  }

  codeNode.clear();
  codeNode.append(...newNodes);
}

/** Character offset of the caret within the code block (text + '\n' per line break). */
function $getCaretOffset(codeNode: CodeNode): number | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchorNode = selection.anchor.getNode();
  const anchorOffset = selection.anchor.offset;

  if (anchorNode.getKey() === codeNode.getKey()) {
    const children = codeNode.getChildren();
    let offset = 0;
    for (let i = 0; i < anchorOffset && i < children.length; i += 1) {
      const child = children[i];
      offset += $isLineBreakNode(child) ? 1 : child.getTextContentSize();
    }
    return offset;
  }

  let offset = 0;
  for (const child of codeNode.getChildren()) {
    if (child.getKey() === anchorNode.getKey()) {
      return offset + anchorOffset;
    }
    offset += $isLineBreakNode(child) ? 1 : child.getTextContentSize();
  }
  return null;
}

/** Restore the caret to a given character offset after the block was rebuilt. */
function $setCaretOffset(codeNode: CodeNode, target: number) {
  let remaining = Math.max(0, target);
  const children = codeNode.getChildren();

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if ($isLineBreakNode(child)) {
      if (remaining <= 0) {
        // Caret is at the end of the previous line.
        if (i > 0) {
          const prev = children[i - 1];
          if (!$isLineBreakNode(prev)) {
            (prev as TextNode).select(
              prev.getTextContentSize(),
              prev.getTextContentSize(),
            );
          }
        }
        return;
      }
      remaining -= 1;
      if (remaining === 0) {
        // Caret is right after the line break = start of the next line.
        // If the next line has its own text node, anchor there; otherwise
        // anchor at the end of the line break (the canonical new-line position).
        const next = children[i + 1];
        if (next && !$isLineBreakNode(next)) {
          (next as TextNode).select(0, 0);
        } else {
          codeNode.select(i + 1, i + 1);
        }
        return;
      }
      continue;
    }
    const size = child.getTextContentSize();
    if (remaining <= size) {
      (child as TextNode).select(remaining, remaining);
      return;
    }
    remaining -= size;
  }

  const last = children[children.length - 1];
  if (last) {
    if ($isLineBreakNode(last)) {
      codeNode.select(children.length, children.length);
    } else {
      (last as TextNode).select(
        last.getTextContentSize(),
        last.getTextContentSize(),
      );
    }
  }
}

const lastHighlighted = new Map<string, string>();

function $getCodeNodeToHighlight(): CodeNode | null {
  const selection = $getSelection();
  if (!selection) return null;
  if ($isRangeSelection(selection)) {
    const anchorNode = selection.anchor.getNode();
    const topLevel = anchorNode.getTopLevelElement();
    if ($isCodeNode(topLevel)) return topLevel;
  }
  return null;
}

export const CodeHighlightExtension = defineExtension({
  name: '@leditor/code-highlight',
  register(editor) {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const codeNode = $getCodeNodeToHighlight();
        if (!codeNode) return;
        const text = codeNode.getTextContent();
        const signature = `${codeNode.getLanguage()}::${text}`;
        if (lastHighlighted.get(codeNode.getKey()) === signature) return;
        const caret = $getCaretOffset(codeNode);
        lastHighlighted.set(codeNode.getKey(), signature);
        const key = codeNode.getKey();
        editor.update(() => {
          const node = $getNodeByKey(key);
          if (!$isCodeNode(node)) return;
          $tokenizeCode(node);
          if (caret !== null) $setCaretOffset(node, caret);
        });
      });
    });
  },
});
