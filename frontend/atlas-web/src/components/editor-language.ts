export type EditorLanguage = 'markdown' | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'json' | 'css' | 'html' | 'text';

export function languageFor(path: string): EditorLanguage {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ({ md: 'markdown', markdown: 'markdown', mdx: 'markdown', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx', json: 'json', css: 'css', scss: 'css', html: 'html', htm: 'html', vue: 'html', svelte: 'html' } as Record<string, EditorLanguage>)[ext] ?? 'text';
}

