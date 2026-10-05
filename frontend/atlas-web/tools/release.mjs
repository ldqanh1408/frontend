#!/usr/bin/env node
// Builds a release: production build with the source commit as build id, a SHA-256 manifest of every file, and a copy in
// release/<channel>/ that the staging Worker serves by commit-pinned URL. Usage: node tools/release.mjs [channel]
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const channel = process.argv[2] || 'staging';
const root = new URL('..', import.meta.url).pathname;
const sh = (c) => execSync(c, { cwd: root, encoding: 'utf8' }).trim();
const dirty = sh('git status --porcelain -- src tools public index.html package.json package-lock.json vite.config.ts tsconfig.json');
const source = sh('git rev-parse HEAD');
const id = `${source.slice(0, 12)}${dirty ? '-dirty' : ''}`;
execSync('npm run typecheck && npx vite build', { cwd: root, stdio: 'inherit', env: { ...process.env, ATLAS_BUILD_ID: id } });

const dist = join(root, 'dist');
const files = {};
const walk = (d) => readdirSync(d).sort().forEach((n) => {
  const p = join(d, n);
  if (statSync(p).isDirectory()) return walk(p);
  const buf = readFileSync(p);
  files[`/${relative(dist, p).split('\\').join('/')}`] = { sha256: createHash('sha256').update(buf).digest('hex'), size: buf.length };
});
walk(dist);
const manifest = { format: 'atlas-web-release/v1', channel, buildId: id, sourceCommit: source, sourceDirty: !!dirty, node: process.version, fileCount: Object.keys(files).length, files };
writeFileSync(join(dist, 'release-manifest.json'), JSON.stringify(manifest, null, 2));
const out = join(root, 'release', channel);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true });
console.log(`release ${channel}: ${manifest.fileCount} files, build ${id}${dirty ? ' (uncommitted source changes!)' : ''}`);
