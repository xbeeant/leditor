import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalSubscription } from '@lexical/react/useLexicalSubscription';
import {
  $getNodeByKey,
  $isElementNode,
  type LexicalEditor,
  type NodeKey,
} from 'lexical';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useEditorMode, useLocale } from '../context';
import { t } from '../i18n';
import {
  $isTemplateFieldNode,
  type TemplateFieldType,
} from '../nodes/template-field-node';

interface TemplateFieldComponentProps {
  value: string;
  required: boolean;
  placeholder: string;
  fieldType: TemplateFieldType;
  options: string[];
  inline: boolean;
  nodeKey: NodeKey;
}

/** 节点变更后每次渲染都被读取的字段快照 */
interface FieldSnapshot {
  value: string;
  required: boolean;
  placeholder: string;
  fieldType: TemplateFieldType;
  options: string[];
  inline: boolean;
}

/** 读取单个字段节点的最细粒度字段。decorator 组件不在 update/read 上下文内，必须经 editorState.read 读取。 */
function readFieldSnapshot(
  editor: LexicalEditor,
  nodeKey: NodeKey,
): FieldSnapshot {
  let snapshot: FieldSnapshot | null = null;
  editor.getEditorState().read(() => {
    const node = $getNodeByKey(nodeKey);
    if ($isTemplateFieldNode(node)) {
      snapshot = {
        value: node.getValue(),
        required: node.isRequired(),
        placeholder: node.getPlaceholder(),
        fieldType: node.getFieldType(),
        options: node.getOptions(),
        inline: node.isInline(),
      };
    }
  });
  // 节点未找到（如正在被移除）——保留调用方传入的初始值
  return (
    snapshot ?? {
      value: '',
      required: false,
      placeholder: '',
      fieldType: 'text',
      options: [],
      inline: true,
    }
  );
}

/**
 * 模板可填写字段组件的渲染逻辑。
 *
 * 根据编辑器模式呈现不同交互：
 * - `design`：字段可编辑（作为默认值/示例），另展开设计配置（占位文案、必填、字段类型、
 *   下拉选项、行内形态）。
 * - `edit`（填写模式）：字段是输入框或下拉，输入内容写回节点；必填空区显示高亮提示。
 * - `readonly`：仅展示字段当前值。
 *
 * `inline` 时渲染为行内元素（嵌在文本流中），否则为独立块级字段。
 */
export function TemplateFieldComponent({
  required,
  placeholder,
  fieldType,
  options,
  inline,
  nodeKey,
}: TemplateFieldComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const mode = useEditorMode();
  const locale = useLocale();

  // 订阅节点变更：任何 setValue/setPlaceholder/setFieldType/... 后立即重新读取
  // 最新字段值，保证下拉选择回显、设计面板配置实时生效。订阅函数身份需稳定
  // （依赖仅 [editor, nodeKey]），否则 useLexicalSubscription 会反复重订阅。
  const fieldSubscription = useCallback(
    (activeEditor: LexicalEditor) => ({
      initialValueFn: () => readFieldSnapshot(activeEditor, nodeKey),
      subscribe: (cb: (snapshot: FieldSnapshot) => void) =>
        activeEditor.registerUpdateListener(() => {
          cb(readFieldSnapshot(activeEditor, nodeKey));
        }),
    }),
    [nodeKey],
  );
  const liveSnapshot = useLexicalSubscription(fieldSubscription);

  // 组件真实数据源 = 节点实时快照；props（decorate 的初始值）仅在快照为空时兜底。
  // 注意：只读模式下节点不会变更，因此快照与 props 等价，行为一致。
  const liveValue = liveSnapshot.value;
  const liveRequired = liveSnapshot.required;
  const livePlaceholder = liveSnapshot.placeholder;
  const liveFieldType = liveSnapshot.fieldType;
  const liveOptions = liveSnapshot.options;
  const liveInline = liveSnapshot.inline;

  // 设计草稿状态。刻意与 prop 解耦（用户可改未确认），但在节点属性被外部
  // 更新（如另一字段切换、undo/redo、自动行内化）时保持同步，避免草稿过期。
  const [designOpen, setDesignOpen] = useState(false);
  const [draftRequired, setDraftRequired] = useState(required);
  const [draftPlaceholder, setDraftPlaceholder] = useState(placeholder);
  const [draftType, setDraftType] = useState<TemplateFieldType>(fieldType);
  const [draftOptions, setDraftOptions] = useState(options.join('\n'));
  const [draftInline, setDraftInline] = useState(inline);

  useEffect(() => setDraftRequired(required), [required]);
  useEffect(() => setDraftPlaceholder(placeholder), [placeholder]);
  useEffect(() => setDraftType(fieldType), [fieldType]);
  useEffect(() => setDraftOptions(options.join('\n')), [options]);
  useEffect(() => setDraftInline(inline), [inline]);

  const editable = mode !== 'readonly';
  const showPlaceholder = editable && liveValue === '';
  const requiredEmpty = mode === 'edit' && liveRequired && liveValue === '';

  // 面板打开期间，字段主体按「设计草稿」实时渲染：
  // 这样在 ⚙ 面板里切换 输入框↔下拉（及选项/行内）能立即看到效果，
  // 不必等「确认」落库。关闭面板后回到已保存的 fieldType。
  const activeFieldType = designOpen ? draftType : liveFieldType;
  const activeOptions = designOpen
    ? draftOptions
        .split(/\n|，|,/)
        .map((s) => s.trim())
        .filter(Boolean)
    : liveOptions;
  const activeInline = designOpen ? draftInline : liveInline;
  const isSelect = activeFieldType === 'select';

  // 输入回写到字段节点
  const handleChange = useCallback(
    (next: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isTemplateFieldNode(node)) {
          node.setValue(next);
        }
      });
    },
    [editor, nodeKey],
  );

  // 设计模式：应用配置
  const applyDesign = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isTemplateFieldNode(node)) {
        node.setRequired(draftRequired);
        node.setPlaceholder(draftPlaceholder);
        node.setType(draftType);
        node.setOptions(
          draftOptions
            .split(/\n|，|,/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        node.setInline(draftInline);
        // 切换为下拉时清空当前值，避免出现选项之外的旧值
        if (draftType === 'select') {
          node.setPlaceholder(draftPlaceholder || '请选择');
        }
      }
    });
    setDesignOpen(false);
  }, [
    editor,
    nodeKey,
    draftRequired,
    draftPlaceholder,
    draftType,
    draftOptions,
    draftInline,
  ]);

  // 设计模式：删除字段，恢复为一个空段落（inline 字段直接移除）
  const removeField = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isTemplateFieldNode(node)) {
        return;
      }
      // inline 字段直接删除
      if (node.isInline()) {
        node.remove();
        return;
      }
      const parent = node.getParent();
      if ($isElementNode(parent) && parent.getChildrenSize() === 1) {
        // 唯一子节点时整体替换父块为段落，避免空白块无法放置
        parent.replace(node);
      } else {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  const containerClass = [
    'leditor-template-field relative',
    activeInline
      ? 'inline-flex align-middle'
      : 'my-1 flex items-stretch overflow-visible',
    'rounded-md border',
    mode === 'design'
      ? 'border-blue-400 bg-blue-50/60'
      : 'border-sky-300 bg-sky-50/50',
    requiredEmpty
      ? 'border-red-400 ring-1 ring-red-300'
      : mode === 'edit'
        ? 'border-dashed'
        : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputClass =
    'w-full bg-transparent px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400';

  // 控件本体：输入框 / 下拉 / 只读文本
  const control = editable ? (
    isSelect ? (
      <select
        className={`${inputClass} cursor-pointer appearance-none`}
        value={liveValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {liveValue === '' && livePlaceholder && (
          <option value="" disabled>
            {livePlaceholder}
          </option>
        )}
        {liveValue !== '' && !activeOptions.includes(liveValue) && (
          // 当前值不在选项列表时保留下拉能正常显示旧值（如从输入框切成下拉）
          <option key={liveValue} value={liveValue}>
            {liveValue}
          </option>
        )}
        {activeOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    ) : (
      <input
        type="text"
        className={inputClass}
        value={liveValue}
        placeholder={
          showPlaceholder
            ? livePlaceholder || t(locale, 'templateFieldEmptyPlaceholder')
            : undefined
        }
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          // 避免在装饰节点内触发编辑器快捷键（如回到父命令）
          e.stopPropagation();
        }}
      />
    )
  ) : (
    <span
      className={`flex-1 px-3 py-1.5 text-sm ${liveValue === '' ? 'text-gray-400' : 'text-gray-800'}`}
    >
      {liveValue === '' && livePlaceholder !== '' ? livePlaceholder : liveValue}
    </span>
  );

  return (
    <span className={containerClass}>
      {control}

      {mode === 'design' && (
        <button
          type="button"
          title={t(locale, 'templateFieldDesign')}
          onClick={() => setDesignOpen((v) => !v)}
          className="flex shrink-0 items-center px-2 text-xs text-blue-600 hover:bg-blue-100"
        >
          ⚙
        </button>
      )}

      {requiredEmpty && (
        <span className="shrink-0 self-center pr-2 text-xs text-red-500">
          {t(locale, 'templateFieldRequiredEmpty')}
        </span>
      )}

      {mode === 'design' && designOpen && (
        <div
          className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-2 shadow-md"
          style={{
            width: activeInline ? 'max-content' : undefined,
            minWidth: '240px',
          }}
          onClick={(e) => e.stopPropagation()}
          // 阻止事件冒泡到编辑器（避免被当作文本区点击）；仅当点到面板空白处
          // （target 即面板本身）才 preventDefault 防止焦点逃逸回编辑器，
          // 点到 input/select/checkbox 时交由原生聚焦，保证可输入、可切换。
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            {t(locale, 'templateFieldPlaceholder')}
            <input
              type="text"
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none focus:border-blue-400"
              value={draftPlaceholder}
              onChange={(e) => setDraftPlaceholder(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={draftRequired}
              onChange={(e) => setDraftRequired(e.target.checked)}
            />
            {t(locale, 'templateFieldRequired')}
          </label>

          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={draftInline}
              onChange={(e) => setDraftInline(e.target.checked)}
            />
            {t(locale, 'templateFieldInline')}
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            {t(locale, 'templateFieldType')}
            <select
              value={draftType}
              onChange={(e) =>
                setDraftType(e.target.value as TemplateFieldType)
              }
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none"
            >
              <option value="text">{t(locale, 'templateFieldTypeText')}</option>
              <option value="select">
                {t(locale, 'templateFieldTypeSelect')}
              </option>
            </select>
          </label>

          {draftType === 'select' && (
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              {t(locale, 'templateFieldOptions')}
              <textarea
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none focus:border-blue-400"
                rows={3}
                value={draftOptions}
                onChange={(e) => setDraftOptions(e.target.value)}
                placeholder={t(locale, 'templateFieldOptionsPlaceholder')}
              />
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={applyDesign}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              {t(locale, 'confirm')}
            </button>
            <button
              type="button"
              onClick={removeField}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              {t(locale, 'templateFieldRemove')}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
