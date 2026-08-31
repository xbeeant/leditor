import { WidthType } from "docx";

const NAMED_COLORS: Record<string, string> = {
  red: "FF0000",
  yellow: "FFFF00",
  blue: "0000FF",
  green: "008000",
  black: "000000",
  white: "FFFFFF",
  gray: "808080",
  purple: "800080",
  orange: "FFA500",
};

/**
 * 将颜色格式统一转换为 Word 支持的 Hex 字符串。
 */
export function normalizeDocxColor(colorStr?: string): string | undefined {
  if (!colorStr) return undefined;
  const str = colorStr.trim().toLowerCase();

  if (NAMED_COLORS[str]) return NAMED_COLORS[str];

  if (str.startsWith("#")) {
    let hex = str.replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return hex.toUpperCase();
  }

  const rgbMatch = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3], 10).toString(16).padStart(2, "0");
    return (r + g + b).toUpperCase();
  }

  return undefined;
}

/**
 * 将 Lexical 导出的宽度转换为 docx 识别的宽度对象。
 */
export function normalizeDocxWidth(widthVal?: number | string) {
  if (widthVal === undefined || widthVal === null) return undefined;

  if (typeof widthVal === "string" && widthVal.endsWith("%")) {
    const percent = parseFloat(widthVal.replace("%", ""));
    return { size: percent, type: WidthType.PERCENTAGE };
  }

  const pixelWidth =
    typeof widthVal === "string" ? parseFloat(widthVal) : widthVal;
  if (!Number.isNaN(pixelWidth)) {
    // Word 中 1px 大约等于 15 DXA (Twips)
    return { size: Math.round(pixelWidth * 15), type: WidthType.DXA };
  }

  return undefined;
}

/**
 * 微型内联 CSS 解析器：将 "color: red; font-size: 14px;" 转为对象映射。
 */
export function parseInlineStyle(styleStr?: string): Record<string, string> {
  if (!styleStr || typeof styleStr !== "string") return {};

  const result: Record<string, string> = {};
  styleStr.split(";").forEach((rule) => {
    if (!rule.trim()) return;
    const separatorIndex = rule.indexOf(":");
    if (separatorIndex !== -1) {
      const key = rule.slice(0, separatorIndex).trim().toLowerCase();
      const value = rule.slice(separatorIndex + 1).trim();
      if (key && value) {
        result[key] = value.replace(/['"]/g, "");
      }
    }
  });
  return result;
}

/**
 * 将阿拉伯数字转换为罗马数字。
 */
export function convertToRoman(num: number): string {
  const lookup: Record<string, number> = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1,
  };
  let roman = "";
  for (const i in lookup) {
    while (num >= (lookup as Record<string, number>)[i]) {
      roman += i;
      num -= (lookup as Record<string, number>)[i];
    }
  }
  return roman;
}

/**
 * 根据 CSS list-style-type 格式化列表序号。
 */
export function formatListNumber(
  value: number,
  styleType: string = "decimal",
): string {
  const type = styleType.toLowerCase();

  if (type === "lower-alpha" || type === "lower-latin") {
    return String.fromCharCode(96 + (((value - 1) % 26) + 1));
  }
  if (type === "upper-alpha" || type === "upper-latin") {
    return String.fromCharCode(64 + (((value - 1) % 26) + 1));
  }
  if (type === "lower-roman" || type === "upper-roman") {
    const roman = convertToRoman(value);
    return type === "lower-roman" ? roman.toLowerCase() : roman;
  }
  return value.toString();
}

const BASE64_HEADER_REGEX = /^data:(image|application)\/[a-z-+]+;base64,/i;

export const isBase64 = (src: string): boolean => {
  if (!src || typeof src !== "string") return false;
  if (!BASE64_HEADER_REGEX.test(src)) return false;
  const dataPart = src.split(",")[1];
  return dataPart ? dataPart.length % 4 === 0 : false;
};

/**
 * 图片下载器：将 url 或 Base64 转换为 Uint8Array（docx 用）。
 */
export const fetchImageAsUint8Array = async (
  url: string,
): Promise<Uint8Array> => {
  if (url.startsWith("data:image/")) {
    const base64Data = url.split(",")[1];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

/**
 * 从图片 buffer 读取真实尺寸。
 */
export function getImageDimensionsFromBuffer(
  buffer: Uint8Array,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("无法读取图片自然尺寸"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * 将 SVG / 图片 URL 转为 PNG dataURL（docx 仅支持位图）。
 */
export const convertToPng = async (src: string): Promise<string> => {
  if (isBase64(src) && src.startsWith("data:image/png")) {
    return src;
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};
