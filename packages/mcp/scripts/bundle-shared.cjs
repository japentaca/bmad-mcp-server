#!/usr/bin/env node
/**
 * Bundle @bmad/shared into mcp's build directory so it can be published
 * without a separate @bmad/shared npm dependency.
 *
 * 1. Builds shared package
 * 2. Copies shared's compiled output into mcp's build/vendor/shared/
 * 3. Rewrites `@bmad/shared` imports in mcp's compiled JS to relative paths
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SHARED_DIR = path.resolve(ROOT, '..', 'shared');
const SHARED_BUILD = path.join(SHARED_DIR, 'build');
const VENDOR_SHARED = path.join(ROOT, 'build', 'vendor', 'shared');
const MCP_BUILD = path.join(ROOT, 'build');

console.error('[bundle-shared] Building @bmad/shared...');
execSync('npm run build', { cwd: SHARED_DIR, stdio: 'pipe' });

console.error('[bundle-shared] Copying shared build to build/vendor/shared/...');
fs.rmSync(VENDOR_SHARED, { recursive: true, force: true });
copyDirSync(SHARED_BUILD, VENDOR_SHARED);

console.error('[bundle-shared] Rewriting @bmad/shared imports...');
rewriteImports(MCP_BUILD, /['"]@bmad\/shared['"]/g, `'./vendor/shared/index.js'`);

// Copy vendor/bmad/ agents into build so they ship with the MCP package
const ROOT_VENDOR = path.resolve(ROOT, '..', '..', 'vendor', 'bmad');
const BUILD_VENDOR = path.join(MCP_BUILD, 'vendor', 'bmad');
if (fs.existsSync(ROOT_VENDOR)) {
  console.error('[bundle-shared] Copying vendor/bmad/ agents...');
  fs.rmSync(BUILD_VENDOR, { recursive: true, force: true });
  copyDirSync(ROOT_VENDOR, BUILD_VENDOR);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteImports(dir, pattern, replacement) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteImports(full, pattern, replacement);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      let content = fs.readFileSync(full, 'utf-8');
      if (content.includes('@bmad/shared')) {
        content = content.replace(pattern, replacement);
        fs.writeFileSync(full, content, 'utf-8');
      }
    }
  }
}
