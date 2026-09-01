import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, type NodeKey } from 'lexical';
import { FileDown, Paperclip, X } from 'lucide-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import { useLocale } from '../LocaleContext';
import { useEmbedConfig } from '../embed';
import { t } from '../i18n';
import { $isFileNode } from '../nodes';

interface FileNodeComponentProps {
  url: string;
  filename: string;
  size?: number;
  nodeKey: NodeKey;
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[i]}`;
}

export function FileNodeComponent({
  url,
  filename,
  size,
  nodeKey,
}: FileNodeComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const embedConfig = useEmbedConfig();
  const locale = useLocale();
  const onDownload = embedConfig?.attachment?.onDownload;

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload(url);
    } else {
      // 兜底：直接在新窗口打开
      window.open(url, '_blank');
    }
  }, [onDownload, url]);

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isFileNode(node)) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  return (
    <div className="my-1 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <Paperclip className="shrink-0 text-gray-400" size={18} />
      <div className="flex-1 truncate">
        <div className="text-sm text-gray-700">{filename}</div>
        {size !== undefined && (
          <div className="text-xs text-gray-400">{formatSize(size)}</div>
        )}
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="flex h-8 items-center gap-1 rounded-md px-3 text-sm text-blue-600 hover:bg-blue-50"
        title={t(locale, 'downloadFile')}
      >
        <FileDown size={16} />
        <span>{t(locale, 'download')}</span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="flex h-8 items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        title={t(locale, 'deleteFile')}
      >
        <X size={16} />
      </button>
    </div>
  );
}
