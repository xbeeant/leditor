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
