import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@lib/db', () => ({
  getDb: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    readDocument: vi.fn().mockResolvedValue({
      projectName: 'p',
      path: 's.md',
      content: '# Story\nTest story',
      contentType: 'markdown',
      version: 1,
      updatedAt: '2026-01-01',
    }),
    saveWorkflowStatus: vi.fn().mockResolvedValue({}),
    readWorkflowStatus: vi.fn().mockResolvedValue(null),
  }),
  initDb: vi.fn().mockResolvedValue(undefined),
  getStorage: vi.fn().mockReturnValue({}),
}));

import { getOrchestrator } from '@lib/dev';

describe('DevOrchestrator', () => {
  let orchestrator: ReturnType<typeof getOrchestrator>;

  beforeEach(() => {
    orchestrator = getOrchestrator();
  });

  describe('job queue', () => {
    it('should enqueue a job and return a jobId', () => {
      const jobId = orchestrator.enqueue('test-project', 1, 'stories/login.md');
      expect(jobId).toBeTruthy();
      expect(jobId).toContain('test-project');
    });

    it('should retrieve a job by id', () => {
      const jobId = orchestrator.enqueue('test-project', 1, 'stories/login.md');
      const job = orchestrator.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.projectName).toBe('test-project');
      expect(job!.storyPath).toBe('stories/login.md');
      expect(job!.status).toBe('queued');
    });

    it('should return undefined for unknown jobId', () => {
      expect(orchestrator.getJob('nonexistent')).toBeUndefined();
    });

    it('should filter jobs by project', () => {
      orchestrator.enqueue('project-a', 1, 's1.md');
      orchestrator.enqueue('project-a', 2, 's2.md');
      orchestrator.enqueue('project-b', 3, 's3.md');

      const jobs = orchestrator.getProjectJobs('project-a');
      expect(jobs.length).toBe(2);
      expect(jobs.every((j) => j.projectName === 'project-a')).toBe(true);
    });

    it('should emit job-queued event', () => {
      const handler = vi.fn();
      orchestrator.on('job-queued', handler);
      orchestrator.enqueue('test', 1, 'story.md');
      expect(handler).toHaveBeenCalledTimes(1);
      orchestrator.off('job-queued', handler);
    });

    it('should generate unique jobIds', () => {
      const id1 = orchestrator.enqueue('p', 1, 'a.md');
      const id2 = orchestrator.enqueue('p', 2, 'b.md');
      expect(id1).not.toBe(id2);
    });
  });

  describe('job state transitions', () => {
    it('should start in queued state', () => {
      const jobId = orchestrator.enqueue('p', 1, 's.md');
      const job = orchestrator.getJob(jobId)!;
      expect(job.status).toBe('queued');
      expect(job.startedAt).toBeUndefined();
      expect(job.completedAt).toBeUndefined();
    });
  });
});
