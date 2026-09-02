import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useDrawioConfig } from '../context';
import { useLocale } from '../context';
import { t } from '../i18n';
import { Modal } from './modal';

/** Draw.io 节点持久化数据：src 为可直接渲染的 SVG data URL，xml 用于再次编辑 */
export type DrawioElement = {
  /** 渲染用 SVG data URL（由 drawio 导出的 SVG 转换而来） */
  src?: string;
  /** drawio 源 XML，用于再次打开编辑时恢复画布 */
  xml?: string;
  /** 图表宽度（像素），可选 */
  width?: number;
};

interface DrawioModalProps {
  isShown: boolean;
  initialValue?: DrawioElement;
  onClose: () => void;
  onSave: (element: DrawioElement) => void;
}

type EventMessage = {
  event:
    | 'init'
    | 'load'
    | 'save'
    | 'autosave'
    | 'export'
    | 'exit'
    | 'configure'
    | '';
  bounds?: { x: number; y: number; width: number; height: number };
  format?: string;
  data?: string;
  exit?: boolean;
  xml?: string;
};

/** 解析 drawio postMessage 数据为统一事件结构 */
function parseEvent(event: MessageEvent): EventMessage {
  if (typeof event.data === 'string') {
    try {
      return JSON.parse(event.data) as EventMessage;
    } catch {
      return { event: '' };
    }
  }
  return event.data as EventMessage;
}

/**
 * 清理 drawio 导出的 SVG：去除 XML 声明 / DOCTYPE，
 * 避免直接注入 innerHTML 时浏览器将其当作处理指令而无法渲染。
 * 保留纯 <svg>...</svg> 以便直接在 DOM 中渲染（<foreignObject> 文本可正常显示）。
 */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/, '')
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .trim();
}

/**
 * Draw.io 嵌入编辑器弹窗。
 * 通过 iframe 加载 drawio 嵌入服务，使用 postMessage 协议双向通信：
 * init -> 加载已有 xml -> 用户编辑 -> save -> 导出 svg -> 保存。
 */
export function DrawioModal({
  onSave,
  initialValue,
  isShown = false,
  onClose,
}: DrawioModalProps): JSX.Element | null {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // 标记是否在保存后退出，用于区分 export 事件是预览还是最终保存
  const exitAfterSave = useRef(false);
  const drawioConfig = useDrawioConfig();
  const locale = useLocale();

  useEffect(() => {
    if (!isShown) return;

    const handleMessage = (messageEvent: MessageEvent) => {
      const { event, data, xml, bounds, exit } = parseEvent(messageEvent);
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const send = (obj: Record<string, unknown>) =>
        iframe.contentWindow?.postMessage(JSON.stringify(obj), '*');

      switch (event) {
        case 'init': {
          // 通知 drawio 加载初始数据（已有 xml 则恢复画布，否则新建）
          const initialXml = initialValue?.xml;
          if (initialXml) {
            send({
              action: 'load',
              autosave: 0,
              spin: false,
              saveAndExit: '1',
              title: t(locale, 'flowchartTitle'),
              xml: initialXml,
            });
          } else {
            send({
              action: 'load',
              autosave: 0,
              spin: false,
              saveAndExit: '1',
              modified: 'unsavedChanges',
              title: t(locale, 'flowchartTitle'),
            });
          }
          break;
        }
        case 'configure':
          // 关闭压缩、隐藏 tab，简化嵌入体验
          iframe.contentWindow.postMessage(
            {
              action: 'configure',
              config: {
                compressXml: false,
                css: '.geTabContainer{display:none !important;}',
              },
            },
            '*',
          );
          break;
        case 'autosave':
          // autosave 已在 load 时禁用，仅作为兜底：导出但不触发最终保存
          send({ action: 'export', format: 'svg', spinKey: 'saving' });
          break;
        case 'save':
          // 用户点击保存：导出 SVG；若携带 exit 标记则保存后关闭
          send({ action: 'export', format: 'svg', spinKey: 'saving' });
          if (exit) exitAfterSave.current = true;
          break;
        case 'exit':
          onClose();
          break;
        case 'export': {
          // data 为 drawio 导出的 SVG 内容，清理后直接持久化为原始 SVG 字符串，
          // 由 DrawioComponent 以 dangerouslySetInnerHTML 内联渲染（<foreignObject>
          // 文本可正常显示，若用 <img> 则会被浏览器安全策略屏蔽）
          const svgStr = data ? sanitizeSvg(data) : '';
          onSave({
            src: svgStr || (initialValue?.src ?? ''),
            xml: xml ?? initialValue?.xml ?? '',
            width: bounds?.width,
          });
          if (exitAfterSave.current) {
            exitAfterSave.current = false;
            onClose();
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isShown, initialValue, onClose, onSave, locale]);

  useEffect(() => {
    if (!isShown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isShown, onClose]);

  if (!isShown) return null;

  const iframeSrc = `${drawioConfig.url}?embed=1&ui=atlas&spin=1&lang=zh&proto=json`;

  return (
    <Modal
      open={isShown}
      onClose={onClose}
      title={t(locale, 'drawioFlowchart')}
      size="full"
    >
      <iframe
        ref={iframeRef}
        title="drawio"
        src={iframeSrc}
        className="h-full w-full border-0"
      />
    </Modal>
  );
}
