declare module 'prismjs' {
  const Prism: {
    languages: Record<string, unknown>;
    tokenize: (
      text: string,
      grammar: unknown,
    ) => Array<
      string | { type: string; alias?: string | string[]; content: unknown }
    >;
  };
  export default Prism;
}

declare module 'prismjs/components/*';

declare module 'plantuml-encoder' {
  const encoder: { encode: (text: string) => string };
  export default encoder;
}

declare module 'diff-match-patch' {
  export const DIFF_DELETE: -1;
  export const DIFF_INSERT: 1;
  export const DIFF_EQUAL: 0;
  export class diff_match_patch {
    diff_main(text1: string, text2: string): Array<[number, string]>;
    diff_cleanupSemantic(diffs: Array<[number, string]>): void;
  }
}
