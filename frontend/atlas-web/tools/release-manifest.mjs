import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

export function channelName(value) {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(value)) throw new Error('Channel must be a short lowercase name, without path separators.');
  return value;
}
export function hashFiles(directory, exclude = []) {
  const files = {};
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      const key = '/' + relative(directory, path).split('\\').join('/');
      if (exclude.includes(key)) continue;
      const bytes = readFileSync(path);
      files[key] = { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
    }
  }
  walk(directory);
  return files;
}
export function sourceDigest(root) {
  const hash = createHash('sha256');
  const inputs = ['src', 'tools', 'public', 'index.html', 'telemetry-console.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.node.json'];
  for (const input of inputs) {
    const path = join(root, input);
    if (!existsSync(path)) continue;
    const entries = statSync(path).isDirectory() ? hashFiles(path) : { '': { sha256: createHash('sha256').update(readFileSync(path)).digest('hex') } };
    for (const [key, value] of Object.entries(entries)) hash.update(input + key + '\0' + value.sha256 + '\n');
  }
  return hash.digest('hex');
}
export function validateManifest(manifest) {
  if (manifest.format !== 'atlas-web-release/v1' || !manifest.files || !manifest.buildId || manifest.fileCount !== Object.keys(manifest.files).length) throw new Error('Invalid release manifest.');
  for (const [path, file] of Object.entries(manifest.files)) {
    if (!path.startsWith('/') || path.includes('..') || path.includes('\\') || !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('Invalid release file: ' + path);
  }
  for (const path of ['/index.html', '/telemetry-console.html']) if (!manifest.files[path]) throw new Error('Release must contain both independent application entries.');
  return manifest;
}
