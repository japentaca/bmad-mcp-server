import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnexStorage } from '../../../src/storage/knex-storage.js';

function createStorage() {
  return new KnexStorage('sqlite://:memory:');
}

describe('KnexStorage (sqlite://:memory:)', () => {
  let storage: KnexStorage;

  beforeEach(async () => {
    storage = createStorage();
    await storage.initialize();
    await storage.ensureProject('proj');
  });

  afterEach(async () => {
    (storage as any).db?.destroy();
  });

  describe('initialize', () => {
    it('should initialize and pass healthCheck', async () => {
      const health = await storage.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should be idempotent', async () => {
      await storage.initialize();
      const health = await storage.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it('should report sqlite3 driver', () => {
      expect(storage.getDriver()).toBe('sqlite3');
    });
  });

  describe('ensureProject', () => {
    it('should create a project without error', async () => {
      await expect(storage.ensureProject('another-project')).resolves.toBeUndefined();
    });

    it('should be idempotent', async () => {
      await storage.ensureProject('my-project');
      await expect(storage.ensureProject('my-project')).resolves.toBeUndefined();
    });
  });

  describe('saveDocument', () => {
    it('should save a document and return it with version 1', async () => {
      const doc = await storage.saveDocument({
        projectName: 'proj',
        path: 'notes/readme.md',
        content: '# Hello',
        contentType: 'markdown',
      });
      expect(doc.version).toBe(1);
      expect(doc.path).toBe('notes/readme.md');
      expect(doc.content).toBe('# Hello');
      expect(doc.updatedAt).toBeTruthy();
    });

    it('should increment version on update', async () => {
      await storage.saveDocument({
        projectName: 'proj', path: 'notes/file.md', content: 'v1', contentType: 'markdown',
      });
      const v2 = await storage.saveDocument({
        projectName: 'proj', path: 'notes/file.md', content: 'v2', contentType: 'markdown',
      });
      expect(v2.version).toBe(2);
      expect(v2.content).toBe('v2');
    });

    it('should store workflow and agent metadata', async () => {
      const doc = await storage.saveDocument({
        projectName: 'proj',
        path: 'spec.yaml',
        content: 'spec: v1',
        contentType: 'yaml',
        workflow: 'prd',
        agent: 'pm',
      });
      expect(doc.workflow).toBe('prd');
      expect(doc.agent).toBe('pm');
    });
  });

  describe('readDocument', () => {
    it('should read back a saved document', async () => {
      await storage.saveDocument({
        projectName: 'proj', path: 'readme.md', content: 'Hello', contentType: 'markdown',
      });
      const doc = await storage.readDocument('proj', 'readme.md');
      expect(doc).not.toBeNull();
      expect(doc!.content).toBe('Hello');
      expect(doc!.version).toBe(1);
    });

    it('should return null for unknown path', async () => {
      const doc = await storage.readDocument('proj', 'nonexistent.md');
      expect(doc).toBeNull();
    });

    it('should return latest version', async () => {
      await storage.saveDocument({
        projectName: 'proj', path: 'file.md', content: 'v1', contentType: 'markdown',
      });
      await storage.saveDocument({
        projectName: 'proj', path: 'file.md', content: 'v2', contentType: 'markdown',
      });
      const doc = await storage.readDocument('proj', 'file.md');
      expect(doc!.version).toBe(2);
      expect(doc!.content).toBe('v2');
    });
  });

  describe('listDocuments', () => {
    beforeEach(async () => {
      await storage.saveDocument({
        projectName: 'proj', path: 'docs/a.md', content: 'A', contentType: 'markdown',
      });
      await storage.saveDocument({
        projectName: 'proj', path: 'docs/b.yaml', content: 'B', contentType: 'yaml',
      });
      await storage.saveDocument({
        projectName: 'proj', path: 'docs/c.md', content: 'C', contentType: 'markdown',
        workflow: 'prd',
      });
    });

    it('should list all documents for a project', async () => {
      const docs = await storage.listDocuments('proj');
      expect(docs).toHaveLength(3);
    });

    it('should filter by contentType', async () => {
      const docs = await storage.listDocuments('proj', { contentType: 'yaml' });
      expect(docs).toHaveLength(1);
      expect(docs[0].path).toBe('docs/b.yaml');
    });

    it('should filter by workflow', async () => {
      const docs = await storage.listDocuments('proj', { workflow: 'prd' });
      expect(docs).toHaveLength(1);
      expect(docs[0].path).toBe('docs/c.md');
    });

    it('should respect limit and offset', async () => {
      const docs = await storage.listDocuments('proj', { limit: 1, offset: 0 });
      expect(docs).toHaveLength(1);
    });
  });

  describe('searchDocuments', () => {
    beforeEach(async () => {
      await storage.saveDocument({
        projectName: 'proj', path: 'docs/readme.md',
        content: 'This is a document about payment gateway integration',
        contentType: 'markdown',
      });
      await storage.saveDocument({
        projectName: 'proj', path: 'docs/auth.md',
        content: 'Authentication module using JWT tokens',
        contentType: 'markdown',
      });
    });

    it('should search by content', async () => {
      const results = await storage.searchDocuments({
        projectName: 'proj', query: 'payment',
      });
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('docs/readme.md');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should return empty for no matches', async () => {
      const results = await storage.searchDocuments({
        projectName: 'proj', query: 'zzznotfound',
      });
      expect(results).toHaveLength(0);
    });

    it('should respect limit', async () => {
      const results = await storage.searchDocuments({
        projectName: 'proj', query: 'document',
        limit: 1,
      });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('workflowStatus', () => {
    it('should save and read workflow status', async () => {
      await storage.saveWorkflowStatus({
        projectName: 'proj',
        workflow: 'prd',
        status: { step: 3, done: false },
        updatedAt: new Date().toISOString(),
      });

      const status = await storage.readWorkflowStatus('proj', 'prd');
      expect(status).not.toBeNull();
      expect(status!.status).toEqual({ step: 3, done: false });
    });

    it('should upsert workflow status', async () => {
      await storage.saveWorkflowStatus({
        projectName: 'proj', workflow: 'prd',
        status: { step: 1 }, updatedAt: new Date().toISOString(),
      });
      await storage.saveWorkflowStatus({
        projectName: 'proj', workflow: 'prd',
        status: { step: 5 }, updatedAt: new Date().toISOString(),
      });

      const status = await storage.readWorkflowStatus('proj', 'prd');
      expect(status!.status).toEqual({ step: 5 });
    });

    it('should return null for unknown workflow', async () => {
      const status = await storage.readWorkflowStatus('proj', 'nonexistent');
      expect(status).toBeNull();
    });

    it('should list all workflow statuses', async () => {
      await storage.saveWorkflowStatus({
        projectName: 'proj', workflow: 'prd',
        status: { step: 1 }, updatedAt: new Date().toISOString(),
      });
      await storage.saveWorkflowStatus({
        projectName: 'proj', workflow: 'architecture',
        status: { step: 2 }, updatedAt: new Date().toISOString(),
      });

      const list = await storage.listWorkflowStatuses('proj');
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.workflow).sort()).toEqual(['architecture', 'prd']);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy for working connection', async () => {
      const health = await storage.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.driver).toBe('sqlite');
    });

    it('should return unhealthy after destroy', async () => {
      await (storage as any).db.destroy();
      const health = await storage.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.driver).toBe('sqlite');
    });
  });
});
