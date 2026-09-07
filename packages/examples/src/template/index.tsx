import {
  Editor,
  type EditorMode,
  checkCompleteness,
  extractAnswers,
} from '@leditor/lexical-editor';
import type { SerializedEditorState } from 'lexical';
import { useState } from 'react';

/**
 * 模板设计模式（design）示例
 *
 * 展示三步工作流：
 * 1. 「设计模板」：进入 design 模式，自由编辑内容并插入可填写字段（工具栏插入 → 高级块 → 模板字段）。
 *    字段可配置占位文案、必填等属性。
 * 2. 「编辑填写」：进入 edit 模式，文档含模板字段时固定内容锁定，仅可填写字段所在区域。
 * 3. 通过 extractAnswers 提取答案、checkCompleteness 校验必填。
 */

/** 一份已设计好的模板：固定文案 + 两个可填写字段 */
const templateValue = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '项目立项申请表',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'heading',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '模板说明：蓝色虚线框为可填写字段，其余内容为固定模板文本，填写模式下不可编辑。字段有两种形态——块级字段独占一行；行内字段可嵌入句子中间。',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '项目名称：',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        type: 'templateField',
        id: 'f_project_name',
        required: true,
        placeholder: '请输入项目名称',
        value: '',
        inline: false,
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '项目优先级：',
            type: 'text',
            version: 1,
          },
          {
            type: 'templateField',
            id: 'f_priority',
            required: true,
            placeholder: '请选择',
            value: '',
            fieldType: 'select',
            options: ['紧急', '高', '普通', '低'],
            inline: true,
            version: 1,
          },
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '（行内下拉字段示例）',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '预计金额（元）：',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        type: 'templateField',
        id: 'f_amount',
        required: true,
        placeholder: '请输入预计金额',
        value: '',
        inline: false,
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '付款方式（块级下拉示例）：',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        type: 'templateField',
        id: 'f_payment',
        required: false,
        placeholder: '请选择',
        value: '',
        fieldType: 'select',
        options: ['一次性付款', '按里程碑', '月结'],
        inline: false,
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '备注（可选）：',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        type: 'templateField',
        id: 'f_note',
        required: false,
        placeholder: '选填，请填写项目备注',
        value: '',
        inline: false,
        version: 1,
      },
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: '注：该模板由设计模式创建，普通用户只能在填写模式下填写字段区域。',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

const MODE_LABELS: Record<EditorMode, string> = {
  edit: '编辑（填写模板）',
  design: '模板设计',
  readonly: '只读',
};

export default function TemplateExample() {
  const [mode, setMode] = useState<EditorMode>('design');
  const [latestValue, setLatestValue] = useState<SerializedEditorState | null>(
    null,
  );

  const answers = latestValue ? extractAnswers(latestValue) : null;
  const completeness = latestValue ? checkCompleteness(latestValue) : null;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 模式切换 */}
      <div className="flex items-center gap-2">
        {(Object.keys(MODE_LABELS) as EditorMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-sm ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
        <span className="ml-2 text-xs text-gray-500">
          {mode === 'design' &&
            '点击工具栏「插入 → 高级块 → 模板字段」可添加可填写字段；字段右侧 ⚙ 可配置占位/必填/行内形态/输入框或下拉。'}
          {mode === 'edit' &&
            '固定内容不可编辑，仅可填写蓝色虚线框内字段；留空必填字段会标红。'}
          {mode === 'readonly' && '纯只读，不可编辑。'}
        </span>
      </div>

      {/* 编辑器 */}
      <div className="flex flex-1 gap-4">
        <div className="min-w-0 flex-1">
          <div className="h-[520px]">
            <Editor
              mode={mode}
              initialValue={templateValue}
              onChange={(value) => setLatestValue(value)}
              placeholder="开始输入..."
            />
          </div>
        </div>

        {/* 答案提取面板 */}
        <aside className="w-72 shrink-0 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          <h3 className="mb-2 font-semibold text-gray-700">
            答案提取（extractAnswers）
          </h3>
          {!answers || Object.keys(answers).length === 0 ? (
            <p className="text-xs text-gray-500">
              暂无模板字段。进入「设计模板」模式，用插入菜单添加字段后返回此处查看。
            </p>
          ) : (
            <ul className="space-y-2">
              {Object.values(answers).map((a) => (
                <li
                  key={a.id}
                  className={`rounded border p-2 ${
                    a.required && !a.filled
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-gray-500">{a.id}</code>
                    <span
                      className={`rounded px-1 text-xs ${
                        a.required
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {a.required ? '必填' : '选填'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-gray-800">
                    {a.filled ? (
                      a.value
                    ) : (
                      <span className="text-gray-400">（未填写）</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {completeness && (
            <div className="mt-3 border-t border-gray-200 pt-2">
              <p className="text-xs text-gray-500">
                {completeness.complete ? (
                  <span className="text-emerald-600">✓ 必填字段已全部填写</span>
                ) : (
                  <span className="text-red-500">
                    ✗ 缺少必填字段：{completeness.missing.join('、')}
                  </span>
                )}
              </p>
            </div>
          )}
          <h3 className="mb-1 mt-4 font-semibold text-gray-700">使用说明</h3>
          <ol className="list-inside list-decimal space-y-1 text-xs text-gray-500">
            <li>
              「设计模板」模式：编辑内容，插入模板字段并配置（块级/行内、输入框/下拉）。
            </li>
            <li>保存的模式 JSON 即模板（固定内容 + 字段标记）。</li>
            <li>「编辑完成」模式：普通用户只能填写字段。</li>
            <li>
              用 <code>extractAnswers</code> 提取答案，
              <code>checkCompleteness</code> 校验必填。
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
