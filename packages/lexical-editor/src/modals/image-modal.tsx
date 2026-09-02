import { ImageIcon } from 'lucide-react';
import type { JSX } from 'react';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocale } from '../context';
import { t } from '../i18n';
import { Modal } from './modal';

interface CursorPosition {
  x: number;
  y: number;
}

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (src: string, altText: string) => void;
  cursorPosition?: CursorPosition | null;
}

export function ImageModal({
  open,
  onClose,
  onConfirm,
  cursorPosition,
}: ImageModalProps): JSX.Element | null {
  const locale = useLocale();
  const [src, setSrc] = useState('');
  const [altText, setAltText] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

  const handleConfirm = useCallback(() => {
    if (src.trim()) {
      onConfirm(src, altText);
      onClose();
    }
  }, [src, altText, onConfirm, onClose]);

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

  const renderFooter = () => (
    <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {t(locale, 'cancel')}
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!src.trim()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t(locale, 'confirm')}
      </button>
    </div>
  );

  useEffect(() => {
    if (open) {
      setSrc('');
      setAltText('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !cursorPosition || !modalRef.current) return;

    const modal = modalRef.current;
    const modalRect = modal.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const MODAL_HEIGHT = modalRect.height || 280;
    const MODAL_WIDTH = modalRect.width || 400;
    const PADDING = 16;

    let x = cursorPosition.x - MODAL_WIDTH / 2;
    let y = cursorPosition.y + 10;

    if (x < PADDING) {
      x = PADDING;
    } else if (x + MODAL_WIDTH > viewportWidth - PADDING) {
      x = viewportWidth - MODAL_WIDTH - PADDING;
    }

    if (y + MODAL_HEIGHT > viewportHeight - PADDING) {
      y = cursorPosition.y - MODAL_HEIGHT - 10;
    }

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

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(locale, 'imageModalTitle')}
      size="md"
      position="custom"
      customStyle={modalStyle}
      innerRef={modalRef as RefObject<HTMLDivElement>}
      showFullscreen={false}
      footer={renderFooter()}
    >
      <div className="p-4" onKeyDown={handleKeyDown}>
        {src ? (
          <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
            <img
              src={src}
              alt={altText}
              className="max-h-32 w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="mb-3 flex h-20 items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-gray-50">
            <ImageIcon size={24} className="text-gray-400" />
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label
              htmlFor="image-modal-url"
              className="mb-1 block text-sm text-gray-700"
            >
              {t(locale, 'imageUrl')} <span className="text-red-500">*</span>
            </label>
            <input
              id="image-modal-url"
              ref={inputRef}
              type="url"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder={t(locale, 'imageUrlPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="image-modal-alt"
              className="mb-1 block text-sm text-gray-700"
            >
              {t(locale, 'altText')}
            </label>
            <input
              id="image-modal-alt"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder={t(locale, 'imageDescription')}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {t(locale, 'imageTip')}
        </div>
      </div>
    </Modal>
  );
}
