/**
 * 锚点信息：评论对应的非破坏性高亮范围。
 * 融合在每条评论中一起存储：序列化后写入后台 comment 表的
 * content_extra（评论内容补充）字段，完全不进入文档 JSON。
 * start/end 为全文文本偏移；quote 为引用原文；
 * prefix/suffix 为前后文，用于编辑导致偏移漂移后的模糊重定位。
 */
export interface CommentAnchor {
  start: number;
  end: number;
  quote: string;
  prefix?: string;
  suffix?: string;
}

/**
 * 与后台 comment 表（DDL）对应的评论结构。
 * 后台存储时只写 DDL 列：锚点 position 序列化进 content_extra；
 * 前端拿到行数据后再解析出 position 字段方便直接使用。
 */
export interface Comment {
  /** 评论ID（后台 bigint，前端用字符串避免精度丢失） */
  commentId: string;
  /** 父评论ID，'0'/缺省 表示顶层评论 */
  parentId?: string;
  /** 根评论ID（回复时指向所属线程的顶层评论） */
  rootId?: string;
  /** 评论的资源ID（如文档ID，对应 rid 列） */
  rid?: string;
  /** 接入的应用ID（对应 appid 列） */
  appid?: string;
  /** 评论内容（content 列） */
  content: string;
  /** 评论内容补充（content_extra 列，JSON 字符串，锚点 position 存于其中） */
  contentExtra: string;
  /** 锚点信息（contentExtra 的解析结果；回复继承根评论的锚点） */
  position?: CommentAnchor;
  /** 评论的用户ID（create_by 列） */
  creator?: string;
  /** 评论者昵称（冗余，nickname 列） */
  nickname?: string;
  /** 评论的帐号（冗余，account 列） */
  account: string;
  /** 点赞数（star 列） */
  star?: number;
  /** 点踩数（dislike 列） */
  dislike?: number;
  /** 评论时间（create_at 列，ISO 字符串） */
  createAt: string;
  /** 回复目标账号（reply_account 列） */
  replyAccount?: string;
  /** 回复目标昵称（reply_nickname 列） */
  replyNickname?: string;
}
