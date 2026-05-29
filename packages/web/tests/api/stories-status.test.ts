import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '../../src/pages/api/stories/[id]/status';

vi.mock('@lib/db', () => {
  const mockDb = {
    initialize: vi.fn().mockResolvedValue(undefined),
    readWorkflowStatus: vi.fn().mockResolvedValue(null),
  };
  return {
    getDb: vi.fn().mockReturnValue(mockDb),
    initDb: vi.fn().mockResolvedValue(undefined),
    getStorage: vi.fn().mockReturnValue(mockDb),
  };
});

vi.mock('@lib/dev', () => ({
  getOrchestrator: vi.fn().mockReturnValue({
    getJob: vi.fn().mockReturnValue(undefined),
  }),
}));

function mockApiContext(url: string, params: Record<string, string> = {}) {
  return {
    params,
    url: new URL(url, 'http://localhost'),
    request: new Request(url),
    redirect: vi.fn(),
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
    },
    locals: {},
    currentLocale: 'en',
  } as any;
}

describe('API: stories/:id/status', () => {
  it('should return 400 when no params provided', async () => {
    const ctx = mockApiContext('http://localhost/api/stories/_/status');
    const response = await GET(ctx);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('projectName');
  });

  it('should return workflow status when projectName and storyPath provided', async () => {
    const { getDb } = await import('@lib/db');
    const mockDb = getDb() as any;
    mockDb.readWorkflowStatus.mockResolvedValue({
      projectName: 'test',
      workflow: 'stories/login.md',
      status: { step: 'implementing', started: true },
      updatedAt: '2026-01-01',
    });

    const ctx = mockApiContext('http://localhost/api/stories/_/status?projectName=test&storyPath=stories/login.md');
    const response = await GET(ctx);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workflowStatus.step).toBe('implementing');
  });

  it('should return 400 for unknown jobId without projectName', async () => {
    const ctx = mockApiContext('http://localhost/api/stories/unknown-job/status');
    const response = await GET(ctx);
    expect(response.status).toBe(400);
  });
});
