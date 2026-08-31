import { DIFF_DELETE, DIFF_INSERT, diff_match_patch } from 'diff-match-patch';

const dmp = new diff_match_patch();

/**
 * 计算新旧 Lexical State 的差异并生成混合 AST。
 * @param oldState 旧版 Lexical JSON
 * @param newState 新版 Lexical JSON
 */
export function computeDiffState(oldState: any, newState: any): any {
  if (!oldState?.root) return newState;
  if (!newState?.root) return oldState;

  return {
    ...newState,
    root: {
      ...newState.root,
      children: compareASTNodes(
        oldState.root.children || [],
        newState.root.children || [],
      ),
    },
  };
}

/**
 * 递归对比 AST 节点层。
 */
function compareASTNodes(oldNodes: any[], newNodes: any[]): any[] {
  const merged: any[] = [];

  // 当前层级若全是 TextNode 或 LineBreakNode（位于段落内部），
  // 放弃节点级对比，改用纯文本聚合打平比对。
  const isInlineLevel =
    oldNodes.every((n) => n.type === 'text' || n.type === 'linebreak') &&
    newNodes.every((n) => n.type === 'text' || n.type === 'linebreak') &&
    (oldNodes.length > 0 || newNodes.length > 0);

  if (isInlineLevel) {
    return diffInlineTextArray(oldNodes, newNodes);
  }

  // 常规块级节点双指针比对
  const maxLen = Math.max(oldNodes.length, newNodes.length);
  for (let i = 0; i < maxLen; i += 1) {
    const oldNode = oldNodes[i];
    const newNode = newNodes[i];

    if (oldNode && !newNode) {
      merged.push(markNodeTree(oldNode, 'deleted'));
    } else if (!oldNode && newNode) {
      merged.push(markNodeTree(newNode, 'added'));
    } else if (oldNode.type === newNode.type) {
      if (newNode.children) {
        merged.push({
          ...newNode,
          children: compareASTNodes(
            oldNode.children || [],
            newNode.children || [],
          ),
        });
      } else {
        if (JSON.stringify(oldNode) === JSON.stringify(newNode)) {
          merged.push(newNode);
        } else {
          merged.push(markNodeTree(oldNode, 'deleted'));
          merged.push(markNodeTree(newNode, 'added'));
        }
      }
    } else {
      merged.push(markNodeTree(oldNode, 'deleted'));
      merged.push(markNodeTree(newNode, 'added'));
    }
  }

  return merged;
}

/**
 * 核心文本对比：提取数组中所有纯文本进行字符级 Diff，再重装为带标记的节点。
 */
function diffInlineTextArray(oldNodes: any[], newNodes: any[]): any[] {
  const oldText = oldNodes
    .map((n) => n.text || (n.type === 'linebreak' ? '\n' : ''))
    .join('');
  const newText = newNodes
    .map((n) => n.text || (n.type === 'linebreak' ? '\n' : ''))
    .join('');

  if (oldText === newText) {
    return newNodes;
  }

  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  const diffNodes: any[] = [];
  for (const [operation, text] of diffs) {
    const parts = text.split('\n');
    parts.forEach((partText, index) => {
      if (partText.length > 0) {
        const referenceNode =
          operation === DIFF_INSERT
            ? newNodes[0] || oldNodes[0]
            : oldNodes[0] || newNodes[0];
        diffNodes.push(createDiffTextNode(partText, operation, referenceNode));
      }
      if (index < parts.length - 1) {
        if (operation === DIFF_DELETE) {
          diffNodes.push(
            createDiffTextNode('↵', DIFF_DELETE, oldNodes[0] || newNodes[0]),
          );
        } else {
          diffNodes.push({ type: 'linebreak', version: 1 });
        }
      }
    });
  }

  return diffNodes;
}

function createDiffTextNode(
  text: string,
  operation: number,
  referenceNode: any,
): any {
  let changes = 'none';
  if (operation === DIFF_INSERT) changes = 'added';
  if (operation === DIFF_DELETE) changes = 'deleted';

  return {
    type: 'text',
    text,
    __changes: changes,
    format: referenceNode?.format || 0,
    style: referenceNode?.style || '',
    detail: 0,
    mode: 'normal',
    version: 1,
  };
}

/**
 * 递归标记器：将整棵节点树打上增/删标记。
 */
function markNodeTree(node: any, status: 'added' | 'deleted'): any {
  if (node.type === 'text') {
    return {
      ...node,
      __changes: status,
    };
  }

  const newNode = { ...node, __changes: status };
  if (newNode.children) {
    newNode.children = (newNode.children as any[]).map((child: any) =>
      markNodeTree(child, status),
    );
  }
  return newNode;
}
