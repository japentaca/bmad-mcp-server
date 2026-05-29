import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startDocWatcher, stopDocWatcher, getWatchDir } from '@lib/doc-watcher';

describe('DocWatcher', () => {
  let tmpDir: string;

  function createTempDir(): string {
    const dir = join(tmpdir(), 'bmad-watcher-test-' + Date.now());
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  afterEach(() => {
    stopDocWatcher();
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should set and return the watch directory', () => {
    tmpDir = createTempDir();
    startDocWatcher(tmpDir, 'test-project');
    expect(getWatchDir()).toBe(tmpDir);
  });

  it('should stop watching when stopDocWatcher is called', () => {
    tmpDir = createTempDir();
    startDocWatcher(tmpDir, 'test-project');
    expect(getWatchDir()).toBe(tmpDir);
    stopDocWatcher();
    expect(getWatchDir()).toBeNull();
  });

  it('should replace existing watcher when started again', () => {
    tmpDir = createTempDir();
    const dir2 = createTempDir();

    startDocWatcher(tmpDir, 'test-project');
    expect(getWatchDir()).toBe(tmpDir);

    startDocWatcher(dir2, 'test-project');
    expect(getWatchDir()).toBe(dir2);

    rmSync(dir2, { recursive: true, force: true });
  });

  it('should survive stop without prior start', () => {
    stopDocWatcher();
    expect(getWatchDir()).toBeNull();
  });
});
