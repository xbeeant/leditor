import type { AttachmentProps } from '../embed';
import type { MediaConfig, MediaUploadResult } from './config';

/**
 * 从 JSON 响应对象中按点路径安全取值。
 * 例如 `urlKey = 'data.list.0.url'` 会取出 `data.list[0].url`。
 */
function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * 通过 XMLHttpRequest 把文件表单上传到 `uploadUrl`，并从响应 JSON 的
 * `urlKey` 字段取出文件地址。支持上传进度回调(可选)。
 */
export function uploadFile(
  file: File,
  config: MediaConfig,
  onProgress?: (percent: number) => void,
): Promise<MediaUploadResult> {
  const { uploadUrl, fieldName = 'file', urlKey = 'url', headers } = config;
  if (!uploadUrl) {
    return Promise.reject(new Error('MediaConfig.uploadUrl is not configured'));
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append(fieldName, file);

    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed with status ${xhr.status}`));
        return;
      }
      const url = getByPath(xhr.response, urlKey);
      if (typeof url !== 'string' || url.length === 0) {
        reject(
          new Error(`Upload response field "${urlKey}" is missing or invalid`),
        );
        return;
      }
      resolve({ url, filename: file.name });
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.open('POST', uploadUrl, true);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
    }
    xhr.send(formData);
  });
}

/**
 * 附件上传结果（含文件元信息）。
 */
export interface AttachmentUploadResult {
  /** 文件访问 URL */
  url: string;
  /** 文件名 */
  filename: string;
  /** 文件大小（字节） */
  size?: number;
  /** 文件 MIME 类型 */
  type?: string;
  /** 文件唯一标识（服务端返回） */
  fid?: string;
}

/**
 * 从服务端响应中提取附件元信息。
 * 根据 `fieldNames` 配置映射响应字段到统一字段。
 */
function extractAttachmentMetadata(
  response: Record<string, unknown>,
  fieldNames: AttachmentProps['fieldNames'],
  filename: string,
): AttachmentUploadResult {
  const fid = getByPath(response, fieldNames?.fid || 'fid') as
    | string
    | undefined;
  const name =
    (getByPath(response, fieldNames?.name || 'name') as string) || filename;
  const size = Number(
    getByPath(response, fieldNames?.size || 'size') ||
      getByPath(response, fieldNames?.size || 'fileSize'),
  );
  const type =
    (getByPath(response, fieldNames?.extension || 'type') as string) ||
    undefined;

  return {
    url: '',
    filename: name,
    size: Number.isNaN(size) ? undefined : size,
    type,
    fid,
  };
}

/**
 * 根据 attachment 配置从响应中提取最终下载 URL。
 */
function resolveAttachmentUrl(
  response: Record<string, unknown>,
  fieldNames: AttachmentProps['fieldNames'],
  downloader: AttachmentProps['downloader'],
  fid: string | undefined,
): string {
  // 优先使用 downloader 函数
  if (typeof downloader === 'function') {
    const result = downloader(response);
    return typeof result === 'string' ? result : '';
  }
  // 其次使用 downloader 字符串拼接 fid
  if (typeof downloader === 'string' && fid) {
    return `${downloader}${fid}`;
  }
  // 兜底：从响应中提取 url 字段
  return (getByPath(response, fieldNames?.url || 'url') as string) || '';
}

/**
 * 通过 attachment.action 上传文件，支持服务端响应字段映射和 downloader。
 * 所有文件（图片/视频/音频/普通文件）都走此函数上传到服务器。
 */
export function uploadAttachment(
  file: File,
  attachment: AttachmentProps,
  onProgress?: (percent: number) => void,
): Promise<AttachmentUploadResult> {
  const { action, fieldNames, downloader } = attachment;
  if (!action) {
    return Promise.reject(
      new Error('AttachmentProps.action is not configured'),
    );
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed with status ${xhr.status}`));
        return;
      }

      const response = xhr.response as Record<string, unknown>;
      const metadata = extractAttachmentMetadata(
        response,
        fieldNames,
        file.name,
      );
      const url = resolveAttachmentUrl(
        response,
        fieldNames,
        downloader,
        metadata.fid,
      );

      if (!url || url.length === 0) {
        reject(new Error('Upload response missing valid URL'));
        return;
      }

      resolve({ ...metadata, url });
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.open('POST', action, true);
    xhr.send(formData);
  });
}

/**
 * 把存储的 src 解析成渲染/下载时可直接访问的地址。
 * 配置了 `beforeDownload` 时调用它，否则原样返回。
 * 如果传入了 embedConfig，还会通过 `attachment.getRealUrl` 进一步解析。
 */
export function resolveMediaUrl(
  src: string,
  mediaConfig?: MediaConfig,
  embedConfig?: { attachment?: { getRealUrl?: (url: string) => string } },
): string {
  if (!src) return src;

  // 1. 先经过 beforeDownload 处理
  let url = mediaConfig?.beforeDownload ? mediaConfig.beforeDownload(src) : src;

  // 2. 再通过 embed.attachment.getRealUrl 解析为可访问地址（跳过 data URL）
  if (url && !url.startsWith('data:') && embedConfig?.attachment?.getRealUrl) {
    url = embedConfig.attachment.getRealUrl(url);
  }

  return url;
}
