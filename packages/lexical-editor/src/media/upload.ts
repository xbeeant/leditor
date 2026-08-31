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
 * 把存储的 src 解析成渲染/下载时可直接访问的地址。
 * 配置了 `beforeDownload` 时调用它，否则原样返回。
 */
export function resolveMediaUrl(src: string, config?: MediaConfig): string {
  if (!src) return src;
  return config?.beforeDownload ? config.beforeDownload(src) : src;
}
