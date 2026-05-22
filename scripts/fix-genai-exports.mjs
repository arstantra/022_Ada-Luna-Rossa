// Workaround for @google/genai@0.14.x broken publish: dist/web/ and dist/index.mjs are missing.
// This script recreates the missing ESM wrappers after npm install.
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../node_modules/@google/genai/dist');
const webDir = resolve(distDir, 'web');

if (!existsSync(resolve(distDir, 'index.mjs'))) {
  writeFileSync(resolve(distDir, 'index.mjs'), "export * from './index.js';\n");
}

if (!existsSync(webDir)) {
  mkdirSync(webDir, { recursive: true });
}

if (!existsSync(resolve(webDir, 'index.mjs'))) {
  writeFileSync(resolve(webDir, 'index.mjs'), "export * from '../index.js';\n");
}
