/**
 * 统一的媒体(图片/视频/音频)上传下载配置。
 * 图片、视频、音频共用同一份配置：上传时把文件 POST 到 `uploadUrl`，
 * 从响应 JSON 的 `urlKey` 字段取出真实地址；渲染或下载时通过
 * `beforeDownload` 对存储的 src 做一次处理以得到可直接访问的地址。
 */
export interface MediaConfig {
  /**
   * 上传接口地址。未配置时禁用文件上传(仅允许手动输入 URL 插入)。
   */
  uploadUrl?: string;
  /**
   * 上传时表单文件字段名，默认 `'file'`。
   */
  fieldName?: string;
  /**
   * 上传响应 JSON 中保存文件地址的字段键，支持 `a.b.c` 点路径，默认 `'url'`。
   */
  urlKey?: string;
  /**
   * 额外的请求头(如鉴权 Token)。
   */
  headers?: Record<string, string>;
  /**
   * 渲染或下载前对存储的 src 做处理，返回可直接访问的地址。
   */
  beforeDownload?: (url: string) => string;
}

export interface MediaUploadResult {
  url: string;
  filename: string;
}
