import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { $isTemplateFieldNode } from '../nodes';

/** 遍历当前编辑器状态，判断文档中是否至少存在一个模板字段。 */
function $hasTemplateFieldsInEditor(): boolean {
  const walk = (nodes: LexicalNode[]): boolean =>
    nodes.some((node) => {
      if ($isTemplateFieldNode(node)) {
        return true;
      }
      if ($isElementNode(node)) {
        return walk(node.getChildren());
      }
      return false;
    });
  return walk($getRoot().getChildren());
}

export interface TemplateFieldsWatcherProps {
  /** 文档含/不含模板字段时回调（每次编辑器提交更新后重新检测） */
  onHasFields: (has: boolean) => void;
}

/**
 * 监听编辑器文档内容，检测是否包含模板字段。
 *
 * 用于把「当前文档是否为模板」实时同步到 React 层，供 `Editor` 决定：
 * - edit（填写）模式下文档含模板字段时隐藏工具栏、向 ReadOnlySync 传只读；
 * - 普通文档（无模板字段）保持完全自由编辑。
 *
 * 必须位于 LexicalExtensionComposer 内部才能拿到 editor 实例。
 */
export function TemplateFieldsWatcher({
  onHasFields,
}: TemplateFieldsWatcherProps): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const report = () => {
      const has = editor.getEditorState().read($hasTemplateFieldsInEditor);
      onHasFields(has);
    };

    report();
    return editor.registerUpdateListener(report);
  }, [editor, onHasFields]);

  return null;
}