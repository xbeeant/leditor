import { createEditor, $getRoot, $createParagraphNode, $createTextNode, TextNode } from './node_modules/lexical/dist/Lexical.dev.mjs';
import { TemplateFieldNode } from './packages/lexical-editor/src/nodes/template-field-node';

const editor = createEditor({
  nodes: [TemplateFieldNode],
  onError: (e) => { console.error('ONERROR:', e.message); process.exitCode = 1; },
});

const seen: string[] = [];
editor.registerNodeTransform(TextNode, (n) => {
  seen.push(n.getType());
  n.isSimpleText();
});

editor.update(() => {
  const p = $createParagraphNode();
  p.append($createTextNode('项目优先级：'));
  const T = (await import('./packages/lexical-editor/src/nodes/template-field-node')).$createTemplateFieldNode;
});
