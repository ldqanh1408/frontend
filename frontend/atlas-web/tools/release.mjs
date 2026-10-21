#!/usr/bin/env node
// Builds a local, reproducible artifact; never deploys or pushes.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelName, hashFiles, sourceDigest, validateManifest } from './release-manifest.mjs';

const channel = channelName(process.argv[2] || 'staging');
const root = fileURLToPath(new URL('..', import.meta.url));
const git = args => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const source = git(['rev-parse', 'HEAD']);
const dirty = source ? git(['status', '--porcelain', '--', 'src', 'tools', 'public', 'index.html', 'telemetry-console.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.node.json']) : null;
if (dirty && process.env.ATLAS_ALLOW_DIRTY_RELEASE !== '1') throw new Error('Commit source changes before releasing; ATLAS_ALLOW_DIRTY_RELEASE=1 explicitly marks a local draft.');
const digest = sourceDigest(root);
const id = source && !dirty ? source.slice(0, 12) : `source-${digest.slice(0, 16)}`;
execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, ATLAS_BUILD_ID: id } });
if (sourceDigest(root) !== digest) throw new Error('Source changed during the build. Retry from a stable checkout.');
const files = hashFiles(join(root, 'dist'), ['/release-manifest.json']);
const manifest = validateManifest({ format: 'atlas-web-release/v1', channel, buildId: id, sourceCommit: source, sourceKind: source ? 'git' : 'archive', sourceDirty: Boolean(dirty), sourceDigest: digest, node: process.version, entries: { workspace: '/index.html', observer: '/telemetry-console.html' }, fileCount: Object.keys(files).length, files });
writeFileSync(join(root, 'dist', 'release-manifest.json'), JSON.stringify(manifest, null, 2));
const out = join(root, 'release', channel);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'dist'), out, { recursive: true });
console.log(`release ${channel}: ${manifest.fileCount} files, build ${id}, source ${manifest.sourceKind}${dirty ? ' (local draft)' : ''}`);
