import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useLocale, useMindConfig } from '../context';
import { t } from '../i18n';
import { Modal } from './modal';

/** 思维导图节点持久化数据：png 为可直接渲染的图片 data URL，json 用于再次编辑 */
export type MindElements = {
  /** 思维导图 JSON 结构（由嵌入服务定义） */
  json: Record<string, unknown>;
  /** 渲染用图片 data URL（PNG） */
  png: string;
};

interface MindModalProps {
  isShown: boolean;
  initialValue?: MindElements;
  onClose: () => void;
  onSave: (elements: MindElements) => void;
}

type EventMessage = {
  action: 'initialed' | 'load' | 'save' | 'save-exit' | 'exit' | '';
  data?: MindElements;
};

function parseEvent(event: MessageEvent): EventMessage {
  if (typeof event.data === 'string') {
    try {
      return JSON.parse(event.data) as EventMessage;
    } catch {
      return { action: '' };
    }
  }
  return event.data as EventMessage;
}

/**
 * 思维导图嵌入编辑器弹窗。
 * 通过 iframe 加载思维导图嵌入服务，使用 postMessage 协议双向通信：
 * onload -> 通知初始化 -> 加载已有 json -> 用户编辑 -> save -> 保存 png + json。
 *
 * 思维导图无公共默认服务，未配置 embed.mind.url 时无法使用。
 */
export function MindModal({
  onSave,
  initialValue,
  isShown = false,
  onClose,
}: MindModalProps): JSX.Element | null {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mindConfig = useMindConfig();
  const locale = useLocale();

  useEffect(() => {
    if (!isShown) return;

    const handleMessage = (msg: MessageEvent) => {
      const { action, data } = parseEvent(msg);
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      switch (action) {
        case 'initialed':
          // 编辑已有数据时通知服务加载
          if (initialValue?.json) {
            iframe.contentWindow.postMessage(
              { action: 'load', data: initialValue.json },
              '*',
            );
          }
          break;
        case 'save':
          if (data) onSave(data);
          break;
        case 'save-exit':
          if (data) onSave(data);
          onClose();
          break;
        case 'exit':
          onClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isShown, initialValue, onClose, onSave]);

  useEffect(() => {
    if (!isShown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isShown, onClose]);

  if (!isShown) return null;

  // 思维导图依赖外部嵌入服务，未配置时提示用户
  if (!mindConfig?.url) {
    return (
      <Modal
        open={isShown}
        onClose={onClose}
        title={t(locale, 'mindMap')}
        size="sm"
      >
        <div className="p-6">
          <p className="mb-4 text-sm text-gray-700">
            {t(locale, 'mindNotConfigured')}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={isShown}
      onClose={onClose}
      title={t(locale, 'mindMap')}
      size="full"
    >
      <iframe
        ref={iframeRef}
        title="mind"
        src={mindConfig.url}
        className="h-full w-full border-0"
        onLoad={() => {
          const iframe = iframeRef.current;
          // 加载完成后通知服务初始化（新建空画布）
          iframe?.contentWindow?.postMessage({ action: 'load', data: '' }, '*');
        }}
      />
    </Modal>
  );
}
