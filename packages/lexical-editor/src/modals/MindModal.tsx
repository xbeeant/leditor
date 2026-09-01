import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../LocaleContext';
import { useMindConfig } from '../embed';
import { FullscreenIcon } from '../embed';
import { t } from '../i18n';

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
  const [fullscreen, setFullscreen] = useState(false);

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
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
        <div className="w-80 rounded-lg bg-white p-6 shadow-2xl">
          <p className="mb-4 text-sm text-gray-700">
            {t(locale, 'mindNotConfigured')}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
            >
              {t(locale, 'close')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div
        className={`flex flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${
          fullscreen
            ? 'h-screen w-screen rounded-none'
            : 'h-[85vh] w-[90vw] max-w-6xl'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <h3 className="text-sm font-medium text-gray-900">
            {t(locale, 'mindMap')}
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={
                fullscreen ? t(locale, 'restore') : t(locale, 'fullscreen')
              }
              onClick={() => setFullscreen((v) => !v)}
              className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
            >
              <FullscreenIcon fullscreen={fullscreen} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            >
              {t(locale, 'close')}
            </button>
          </div>
        </div>
        <iframe
          ref={iframeRef}
          title="mind"
          src={mindConfig.url}
          className="flex-1 border-0"
          onLoad={() => {
            const iframe = iframeRef.current;
            // 加载完成后通知服务初始化（新建空画布）
            iframe?.contentWindow?.postMessage(
              { action: 'load', data: '' },
              '*',
            );
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
