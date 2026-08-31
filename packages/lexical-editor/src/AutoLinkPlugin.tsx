import { $isCodeNode } from '@lexical/code-core';
import {
  AutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from '@lexical/react/LexicalAutoLinkPlugin';

const URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/;

const EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => {
    return text.startsWith('http') ? text : `https://${text}`;
  }),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => {
    return `mailto:${text}`;
  }),
];

// 代码块内不进行自动链接转换
const EXCLUDE_PARENTS = [$isCodeNode];

/**
 * 自动链接插件：输入或粘贴 URL / 邮箱地址时自动转换为可点击链接。
 * 代码节点（code block）内的内容不会被转换。
 */
export function LexicalAutoLinkPlugin() {
  return (
    <AutoLinkPlugin matchers={MATCHERS} excludeParents={EXCLUDE_PARENTS} />
  );
}
