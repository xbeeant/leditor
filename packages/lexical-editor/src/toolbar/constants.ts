/** 字体（参考 ca/lexical/packages/lib 实现） */
export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'DengXian, 等线, sans-serif', label: '等线' },
  { value: 'DengXian Light, 等线 Light, sans-serif', label: '等线 Light' },
  {
    value: 'FangSong, 仿宋, FZFangSong-Z02S, STFangsong, fangsong',
    label: '仿宋',
  },
  {
    value: 'STFangsong, 华文仿宋, FangSong, FZFangSong-Z02S, fangsong',
    label: '华文仿宋',
  },
  {
    value: 'STSong, 华文宋体, SimSun, Songti SC, NSimSun, serif',
    label: '华文宋体',
  },
  {
    value: 'STKaiti, 华文楷体, KaiTi, Kaiti SC, cursive',
    label: '华文楷体',
  },
  {
    value: 'SimSun, 宋体, Songti SC, NSimSun, STSong, serif',
    label: '宋体',
  },
  {
    value: 'Microsoft YaHei, 微软雅黑, PingFang SC, SimHei, STHeiti, sans-serif',
    label: '微软雅黑',
  },
  { value: 'KaiTi, 楷体, STKaiti, Kaiti SC, cursive', label: '楷体' },
  {
    value: 'SimHei, 黑体, Microsoft YaHei, PingFang SC, STHeiti, sans-serif',
    label: '黑体',
  },
  { value: 'LiSu, 隶书, serif', label: '隶书' },
  { value: 'YouYuan, 幼圆, sans-serif', label: '幼圆' },
  { value: 'STXingkai, 华文行楷, cursive', label: '华文行楷' },
  { value: 'STXinwei, 华文新魏, cursive', label: '华文新魏' },
  { value: 'FZShuTi, 方正舒体, cursive', label: '方正舒体' },
  { value: 'FZYaoti, 方正姚体, serif', label: '方正姚体' },
];

/** 字号（参考 ca/lexical/packages/lib 实现） */
export const FONT_SIZES = [
  '14px',
  '15px',
  '16px',
  '18px',
  '20px',
  '22px',
  '24px',
  '26px',
  '28px',
  '30px',
  '32px',
  '34px',
  '36px',
  '38px',
  '40px',
  '44px',
  '48px',
];

export const MIXED_FONT_SIZE = 'mixed';

/** 各标题级别的默认字号 */
export const HEADING_FONT_SIZE_MAP: Record<string, string> = {
  h1: '30px',
  h2: '24px',
  h3: '20px',
  h4: '18px',
  h5: '16px',
  h6: '14px',
};

export const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'json',
  'bash',
  'css',
  'markup',
  'plaintext',
];
