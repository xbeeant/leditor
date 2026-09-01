/**
 * 外部 iframe 嵌入服务配置（Draw.io / 思维导图）。
 *
 * 这类节点通过 iframe 嵌入第三方可视化编辑器，编辑结果以图片形式
 * 持久化到节点数据中。`url` 指向可嵌入的编辑器地址；当已保存的图表
 * 数据里只存了服务端相对路径时，通过 `getRealUrl` / `onRequest`
 * 解析为可直接渲染 / 编辑的内容。
 */
export interface EmbedServiceConfig {
  /** iframe 嵌入服务地址（需支持 embed 协议） */
  url: string;
  /** 将存储的相对 src 解析为可直接访问的地址，用于渲染已保存的图表 */
  getRealUrl?: (url: string) => string;
  /** 按相对 src 异步获取原始内容（SVG / XML），用于编辑已保存的图表 */
  onRequest?: (url: string) => Promise<string>;
}

/**
 * 附件上传服务端响应中的字段名配置。
 * 不同后端返回的字段名可能不同，通过此配置做映射。
 */
export interface AttachmentFieldNames {
  /** 文件唯一标识 */
  fid?: string;
  /** 文件名 */
  name?: string;
  /** 文件大小 */
  size?: string;
  /** 文件扩展名 */
  extension?: string;
  /** 文件访问 URL */
  url?: string;
}

/**
 * 附件上传/下载的统一配置。
 *
 * 所有文件（图片/视频/音频/普通文件）都通过此配置提交到服务器：
 * - `action`：上传接口地址，表单字段名为 `file`
 * - `onDownload`：下载回调，收到服务端返回的文件数据后触发下载
 * - `downloader`：可选，根据服务端响应数据生成实际下载 URL
 * - `fieldNames`：可选，映射服务端响应字段名到统一字段
 */
export interface AttachmentProps {
  /** 上传接口地址（必填） */
  action: string;
  /**
   * 下载 URL 生成函数。根据服务端返回的响应数据生成实际可访问的下载 URL。
   * 未配置时使用 `fieldNames.url` 字段的值作为 URL。
   */
  downloader?: string | ((data: Record<string, unknown>) => string);
  /**
   * 获取真实的文件地址
   */
  getRealUrl?: (url: string) => string;
  /**
   * 服务端响应字段名映射。未配置时使用默认字段名（fid/name/size/extension/url）。
   */
  fieldNames?: AttachmentFieldNames;
  /**
   * 下载回调。当用户点击下载按钮时调用，接收生成好的下载 URL。
   */
  onDownload: (url: string) => void;
}

export interface EmbedConfig {
  /**
   * Draw.io 图表嵌入服务配置。
   * 未配置时使用公共嵌入服务 https://embed.diagrams.net/。
   */
  drawio?: EmbedServiceConfig;
  /**
   * 思维导图嵌入服务配置。
   * 无公共默认服务，未配置时该功能不可用。
   */
  mind?: EmbedServiceConfig;
  /**
   * 附件（图片/视频/音频/文件）上传下载配置。
   * 所有文件操作都走此配置：上传到 `action`，下载触发 `onDownload`。
   */
  attachment?: AttachmentProps;
}

/** Draw.io 公共嵌入服务地址，未显式配置时使用 */
export const DEFAULT_DRAWIO_URL = 'https://embed.diagrams.net/';
