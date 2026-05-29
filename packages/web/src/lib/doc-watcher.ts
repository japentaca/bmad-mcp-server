import { watch, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { getDb } from './db';

let watcher: ReturnType<typeof watch> | null = null;
let watchDir: string | null = null;

export function startDocWatcher(dir: string, projectName: string): void {
  if (watcher) stopDocWatcher();
  watchDir = dir;

  console.error(`[doc-watcher] Watching ${dir} for project "${projectName}"`);

  syncExisting(dir, projectName);

  watcher = watch(dir, { persistent: true, recursive: true }, async (_eventType, filename) => {
    if (!filename || !filename.endsWith('.md')) return;
    if (filename.startsWith('.') || filename.includes('node_modules')) return;

    const filePath = join(dir, filename);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const docPath = filename.replace(/\\/g, '/');
      const storyName = basename(filename, '.md');

      const db = getDb();
      await db.initialize();
      await db.ensureProject(projectName);
      await db.saveDocument({
        projectName,
        path: docPath,
        content,
        contentType: 'markdown',
        workflow: storyName,
      });

      console.error(`[doc-watcher] Synced: ${docPath}`);
    } catch (err) {
      console.error(`[doc-watcher] Error syncing ${filePath}:`, err instanceof Error ? err.message : String(err));
    }
  });
}

function walkDir(dir: string, files: string[], base: string): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walkDir(fullPath, files, base);
      } else if (entry.isFile()) {
        files.push(fullPath.replace(base, '').replace(/^[\\/]/, ''));
      }
    }
  } catch {}
}

function syncExisting(dir: string, projectName: string): void {
  try {
    const files: string[] = [];
    walkDir(dir, files, dir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const docPath = file.replace(/\\/g, '/');
        const db = getDb();
        db.saveDocument({
          projectName,
          path: docPath,
          content,
          contentType: 'markdown',
          workflow: basename(file, '.md'),
        }).catch(() => {});
      } catch {}
    }
    console.error(`[doc-watcher] Synced ${files.filter((f) => f.endsWith('.md')).length} existing files`);
  } catch {}
}

export function stopDocWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    watchDir = null;
    console.error('[doc-watcher] Stopped');
  }
}

export function getWatchDir(): string | null {
  return watchDir;
}
