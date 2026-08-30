import katex from 'katex';
import { X } from 'lucide-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface CursorPosition {
  x: number;
  y: number;
}

interface EquationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (equation: string) => void;
  initialEquation?: string;
  title?: string;
  cursorPosition?: CursorPosition | null;
}

export function EquationModal({
  open,
  onClose,
  onConfirm,
  initialEquation = '',
  title = '插入公式',
  cursorPosition,
}: EquationModalProps): JSX.Element | null {
  const [equation, setEquation] = useState(initialEquation);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (open) {
      setEquation(initialEquation);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, initialEquation]);

  // 计算模态框位置
  useEffect(() => {
    if (!open || !cursorPosition || !modalRef.current) return;

    const modal = modalRef.current;
    const modalRect = modal.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const MODAL_HEIGHT = modalRect.height || 380;
    const MODAL_WIDTH = modalRect.width || 448;
    const PADDING = 16;

    let x = cursorPosition.x - MODAL_WIDTH / 2;
    let y = cursorPosition.y + 10; // 光标下方10px

    // 水平方向：防止超出左右边界
    if (x < PADDING) {
      x = PADDING;
    } else if (x + MODAL_WIDTH > viewportWidth - PADDING) {
      x = viewportWidth - MODAL_WIDTH - PADDING;
    }

    // 垂直方向：处理触底
    if (y + MODAL_HEIGHT > viewportHeight - PADDING) {
      // 触底：显示在光标上方
      y = cursorPosition.y - MODAL_HEIGHT - 10;
    }

    // 垂直方向：处理触顶
    if (y < PADDING) {
      y = PADDING;
    }

    setModalStyle({
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: 100,
    });
  }, [open, cursorPosition]);

  useEffect(() => {
    if (!open || !previewRef.current) return;
    try {
      katex.render(equation || ' ', previewRef.current, {
        displayMode: true,
        errorColor: '#cc0000',
        output: 'html',
        strict: 'warn',
        throwOnError: false,
        trust: false,
      });
    } catch {
      previewRef.current.textContent = '公式语法错误';
    }
  }, [equation, open]);

  const handleConfirm = useCallback(() => {
    if (equation.trim()) {
      onConfirm(equation);
      onClose();
    }
  }, [equation, onConfirm, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleConfirm();
      }
    },
    [onClose, handleConfirm],
  );

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div
        ref={modalRef}
        style={modalStyle}
        className="w-[28rem] rounded-lg border border-gray-200 bg-white shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:text-gray-500"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-3 min-h-[60px] rounded-md border border-gray-200 bg-gray-50 p-3">
            <div ref={previewRef} className="text-center" />
          </div>
          <textarea
            ref={textareaRef}
            value={equation}
            onChange={(e) => setEquation(e.target.value)}
            placeholder="输入 LaTeX 公式，如 \frac{a}{b} 或 E=mc^2"
            className="h-28 w-full resize-none rounded-md border border-gray-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="mt-2 text-xs text-gray-500">
            提示：按 Cmd/Ctrl+Enter 确认，Esc 取消
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!equation.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            确认
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
