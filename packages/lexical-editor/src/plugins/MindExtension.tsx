import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ReactExtension } from '@lexical/react/ReactExtension';
import { $wrapNodeInElement } from '@lexical/utils';
import {
  $createParagraphNode,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  type LexicalCommand,
  configExtension,
  createCommand,
  defineExtension,
} from 'lexical';
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { type MindElements, MindModal } from '../modals';
import { $createMindNode, MindNode } from '../nodes';

/** 插入思维导图命令，payload 为已有数据（编辑场景）或 undefined（新建） */
export const INSERT_MIND_COMMAND: LexicalCommand<MindElements | undefined> =
  createCommand('INSERT_MIND_COMMAND');

/**
 * 思维导图插件：注册插入命令，打开 MindModal 让用户绘制，
 * 保存后将 MindNode 插入到当前选区位置。
 */
function MindPluginInner(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialValue, setInitialValue] = useState<MindElements | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!editor.hasNodes([MindNode])) {
      throw new Error('MindPlugin: MindNode 未在编辑器中注册');
    }
    return editor.registerCommand(
      INSERT_MIND_COMMAND,
      (payload: MindElements | undefined) => {
        setInitialValue(payload);
        setModalOpen(true);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  const onSave = (elements: MindElements) => {
    editor.update(() => {
      const node = $createMindNode(elements);
      $insertNodes([node]);
      if ($isRootOrShadowRoot(node.getParentOrThrow())) {
        $wrapNodeInElement(node, $createParagraphNode).selectEnd();
      }
    });
    setModalOpen(false);
  };

  return modalOpen ? (
    <MindModal
      initialValue={initialValue}
      isShown={modalOpen}
      onClose={() => setModalOpen(false)}
      onSave={onSave}
    />
  ) : null;
}

/** 思维导图扩展：注册插入命令，打开 MindModal 让用户绘制思维导图。 */
export const MindExtension = defineExtension({
  name: '@leditor/mind',
  dependencies: [
    configExtension(ReactExtension, {
      decorators: [<MindPluginInner key="mind" />],
    }),
  ],
});
