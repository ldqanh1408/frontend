import { describe, expect, it } from 'vitest';
import { importFolder, LIMITS } from './sources';
function file(name: string, content: Uint8Array | string): File {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return { name, size: bytes.byteLength, webkitRelativePath: `repo/${name}`, arrayBuffer: async () => bytes.slice().buffer } as File;
}
describe('source snapshot admission', () => {
  it('detects binary extensions, NUL bytes and invalid UTF-8, while ignoring build directories', async () => {
    const s = await importFolder([file('good.ts', 'export const x = 1;'), file('data.txt', new Uint8Array([0, 65])), file('bad.ts', new Uint8Array([255, 255])), file('image.png', 'text'), file('node_modules/a.ts', 'x')]);
    expect(s.files.filter(f => f.binary).map(f => f.path)).toEqual(['bad.ts', 'data.txt', 'image.png']);
    expect(s.files.find(f => f.path === 'good.ts')?.text).toContain('export');
    expect(s.skipped).toContainEqual({ path: 'node_modules', reason: 'Ignored directory' });
  });
  it('reports file size and count limits without silently dropping input', async () => {
    const files = Array.from({ length: LIMITS.files + 1 }, (_, i) => file(`f${i}.ts`, 'x'));
    const s = await importFolder([file('huge.ts', new Uint8Array(LIMITS.fileBytes + 1)), ...files]);
    expect(s.files).toHaveLength(LIMITS.files);
    expect(s.skipped).toHaveLength(2);
    expect(s.skipped.map(f => f.reason).join(' ')).toMatch(/512 KB.*3000-file limit/);
  });
  it('reports the total snapshot limit independently of each file limit', async () => {
    const bytes = new Uint8Array(LIMITS.fileBytes).fill(65);
    const count = LIMITS.totalBytes / LIMITS.fileBytes;
    const s = await importFolder([...Array.from({ length: count }, (_, i) => file(`large${i}.ts`, bytes)), file('over.ts', 'x')]);
    expect(s.files).toHaveLength(count);
    expect(s.skipped).toContainEqual({ path: 'over.ts', reason: 'Snapshot size limit reached' });
  });
});
