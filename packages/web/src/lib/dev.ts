import { EventEmitter } from 'node:events';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db';

export interface StoryJob {
  id: string;
  projectName: string;
  storyId: number;
  storyPath: string;
  status: 'queued' | 'running' | 'reviewing' | 'testing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  error?: string;
  reviewResult?: ReviewResult;
  testResult?: TestResult;
}

interface OpenCodeResult {
  summary: string;
  filesChanged: string[];
  rawText: string;
}

interface ReviewResult {
  approved: boolean;
  issues: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

interface TestResult {
  allPassing: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  failures: string[];
}

class DevOrchestrator extends EventEmitter {
  private jobs = new Map<string, StoryJob>();
  private running = false;
  private queue: string[] = [];

  enqueue(projectName: string, storyId: number, storyPath: string): string {
    const jobId = `${projectName}:${storyId}:${Date.now()}`;
    const job: StoryJob = {
      id: jobId,
      projectName,
      storyId,
      storyPath,
      status: 'queued',
    };
    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    this.emit('job-queued', job);

    if (!this.running) {
      this.processQueue();
    }

    return jobId;
  }

  getJob(jobId: string): StoryJob | undefined {
    return this.jobs.get(jobId);
  }

  getProjectJobs(projectName: string): StoryJob[] {
    return Array.from(this.jobs.values()).filter((j) => j.projectName === projectName);
  }

  private async processQueue(): Promise<void> {
    if (this.running || this.queue.length === 0) return;
    this.running = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);
      if (!job || job.status !== 'queued') continue;

      await this.executeJob(job);
    }

    this.running = false;
  }

  private async executeJob(job: StoryJob): Promise<void> {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    this.emit('job-started', job);

    const db = getDb();
    await db.initialize();

    const doc = await db.readDocument(job.projectName, job.storyPath);
    if (!doc) {
      this.failJob(job, `Story document not found: ${job.storyPath}`, db);
      return;
    }

    const storyContent = doc.content;

    // ── STAGE 1: DEV ────────────────────────────────────────
    await this.updateWorkflowStatus(db, job, {
      step: 'implementing',
      started: true,
      startedAt: job.startedAt,
    });
    this.emit('job-progress', { job, stage: 'dev', step: 'implementing' });

    let devResult: OpenCodeResult;
    try {
      devResult = await runOpenCodeSession(buildDevPrompt(storyContent, job.projectName), job, 'dev');
    } catch (err) {
      this.failJob(job, `DEV stage failed: ${err instanceof Error ? err.message : String(err)}`, db);
      return;
    }

    // ── STAGE 2: ADVERSARIAL REVIEW ─────────────────────────
    job.status = 'reviewing';
    await this.updateWorkflowStatus(db, job, {
      step: 'reviewing',
      started: true,
      startedAt: job.startedAt,
      inReview: true,
      devSummary: devResult.summary,
      devFiles: devResult.filesChanged,
    });
    this.emit('job-progress', { job, stage: 'review', step: 'reviewing' });

    let reviewResult: ReviewResult;
    try {
      reviewResult = await runReviewSession(storyContent, devResult, job);
    } catch (err) {
      this.failJob(job, `REVIEW stage failed: ${err instanceof Error ? err.message : String(err)}`, db);
      return;
    }

    job.reviewResult = reviewResult;

    if (!reviewResult.approved && reviewResult.severity === 'critical') {
      await this.updateWorkflowStatus(db, job, {
        step: 'review_rejected',
        started: true,
        inReview: true,
        reviewRejected: true,
        reviewResult,
      });
      this.emit('job-progress', { job, stage: 'review', result: 'rejected', reviewResult });
      job.status = 'failed';
      job.error = `Review rejected (${reviewResult.severity}): ${reviewResult.issues.join('; ')}`;
      this.emit('job-failed', job);
      return;
    }

    if (!reviewResult.approved) {
      await this.updateWorkflowStatus(db, job, {
        step: 'review_feedback',
        started: true,
        inReview: true,
        reviewFeedback: true,
        reviewResult,
      });
      this.emit('job-progress', { job, stage: 'review', result: 'feedback', reviewResult });
      job.status = 'failed';
      job.error = `Review feedback (${reviewResult.severity}): ${reviewResult.issues.slice(0, 3).join('; ')}`;
      this.emit('job-failed', job);
      return;
    }

    // ── STAGE 3: TEST ───────────────────────────────────────
    job.status = 'testing';
    await this.updateWorkflowStatus(db, job, {
      step: 'testing',
      started: true,
      inReview: false,
      reviewApproved: true,
      reviewResult,
    });
    this.emit('job-progress', { job, stage: 'test', step: 'testing' });

    let testResult: TestResult;
    try {
      testResult = await runTestSession(storyContent, devResult, job);
    } catch (err) {
      this.failJob(job, `TEST stage failed: ${err instanceof Error ? err.message : String(err)}`, db);
      return;
    }

    job.testResult = testResult;

    if (!testResult.allPassing) {
      await this.updateWorkflowStatus(db, job, {
        step: 'test_failed',
        started: true,
        testFailed: true,
        testResult,
      });
      this.emit('job-progress', { job, stage: 'test', result: 'failed', testResult });
      job.status = 'failed';
      job.error = `Tests failed: ${testResult.failed}/${testResult.totalTests}`;
      this.emit('job-failed', job);
      return;
    }

    // ── SUCCESS ─────────────────────────────────────────────
    await this.updateWorkflowStatus(db, job, {
      step: 'completed',
      started: true,
      completed: true,
      completedAt: new Date().toISOString(),
      summary: devResult.summary,
      filesChanged: devResult.filesChanged,
      reviewResult,
      testResult,
    });

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.summary = devResult.summary;
    this.emit('job-completed', job);
  }

  private async updateWorkflowStatus(
    db: ReturnType<typeof getDb>,
    job: StoryJob,
    status: Record<string, unknown>,
  ): Promise<void> {
    try {
      await db.saveWorkflowStatus({
        projectName: job.projectName,
        workflow: job.storyPath,
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[dev] Failed to update workflow status:', err);
    }
  }

  private async failJob(
    job: StoryJob,
    error: string,
    db: ReturnType<typeof getDb>,
  ): Promise<void> {
    job.status = 'failed';
    job.error = error;
    try {
      await db.saveWorkflowStatus({
        projectName: job.projectName,
        workflow: job.storyPath,
        status: {
          step: 'failed',
          failed: true,
          started: true,
          startedAt: job.startedAt,
          error,
        },
        updatedAt: new Date().toISOString(),
      });
    } catch {}
    this.emit('job-failed', job);
  }
}

// ── PROMPT BUILDERS ──────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveVendorPath(): string {
  const envPath = process.env.BMAD_VENDOR_PATH;
  if (envPath) return envPath;
  return join(__dirname, '..', '..', '..', '..', 'vendor', 'bmad');
}

function loadAgentDefinition(name: string): string {
  const vendorPath = resolveVendorPath();
  const agentPath = join(vendorPath, `${name}.md`);

  if (existsSync(agentPath)) {
    return readFileSync(agentPath, 'utf-8');
  }

  console.error(`[dev] Agent not found: ${agentPath}, using embedded fallback`);
  return `You are a BMAD ${name} agent. Follow your best practices for this role.`;
}

function buildDevPrompt(storyContent: string, projectName: string): string {
  const agentDef = loadAgentDefinition('dev');
  return `${agentDef}

## PROJECT
${projectName}

## STORY TO IMPLEMENT
${storyContent}

Complete this story now. Follow your process above.`;
}

function buildReviewPrompt(
  storyContent: string,
  devResult: OpenCodeResult,
): string {
  const agentDef = loadAgentDefinition('reviewer');
  return `${agentDef}

## STORY REQUIREMENTS
${storyContent}

## IMPLEMENTATION SUMMARY
${devResult.summary}

## FILES CHANGED
${devResult.filesChanged.map((f) => `- ${f}`).join('\n')}

Review this implementation now. Follow your process above.`;
}

function buildTestPrompt(
  storyContent: string,
  devResult: OpenCodeResult,
): string {
  const agentDef = loadAgentDefinition('tea');
  return `${agentDef}

## STORY
${storyContent}

## IMPLEMENTATION
${devResult.summary}

## FILES
${devResult.filesChanged.map((f) => `- ${f}`).join('\n')}

Run tests and verify this implementation now. Follow your process above.`;
}

// ── SESSION RUNNERS ─────────────────────────────────────────

async function runOpenCodeSession(
  prompt: string,
  job: StoryJob,
  stage: string,
): Promise<OpenCodeResult> {
  const devOrchestrator = getOrchestrator();

  try {
    /* eslint-disable */
    // @ts-ignore - dynamic import of optional dependency
    const sdk: any = await import('@opencode-ai/sdk');
    const { client, server }: { client: any; server: any } = await sdk.createOpencode();
    /* eslint-enable */

    try {
      const session = await client.session.create({
        body: { title: `${stage}: ${job.storyPath}` },
      });

      devOrchestrator.emit('job-progress', {
        job,
        stage,
        step: 'session-created',
        sessionId: session.data?.id,
      });

      const result = await client.session.prompt({
        path: { id: session.data!.id! },
        body: {
          parts: [{ type: 'text', text: prompt }],
        },
      });

      const responseText = extractResponseText(result);
      const parsed = parseDevOutput(responseText);

      return { ...parsed, rawText: responseText };
    } finally {
      server.close();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('Cannot find module') || msg.includes('@opencode-ai/sdk')) {
      console.error('[dev] @opencode-ai/sdk not installed. Run: npm install @opencode-ai/sdk');
      console.error('[dev] Falling back to simulated execution for:', job.storyPath);

      devOrchestrator.emit('job-progress', { job, stage, step: 'simulating', note: 'SDK not available' });

      return simulateExecution(prompt, job);
    }

    throw err;
  }
}

async function runReviewSession(
  storyContent: string,
  devResult: OpenCodeResult,
  job: StoryJob,
): Promise<ReviewResult> {
  const prompt = buildReviewPrompt(storyContent, devResult);
  const result = await runOpenCodeSession(prompt, job, 'review');
  return parseReviewOutput(result.rawText);
}

async function runTestSession(
  storyContent: string,
  devResult: OpenCodeResult,
  job: StoryJob,
): Promise<TestResult> {
  const prompt = buildTestPrompt(storyContent, devResult);
  const result = await runOpenCodeSession(prompt, job, 'test');
  return parseTestOutput(result.rawText);
}

// ── OUTPUT PARSERS ──────────────────────────────────────────

function extractResponseText(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (r.data && typeof r.data === 'object') {
      const d = r.data as Record<string, unknown>;
      if (d.info && typeof d.info === 'object') {
        const info = d.info as Record<string, unknown>;
        if (info.text && typeof info.text === 'string') return info.text;
        if (info.content) return String(info.content);
      }
      if (d.text && typeof d.text === 'string') return d.text;
    }
    if (r.text && typeof r.text === 'string') return r.text;
    if (r.content) return String(r.content);
  }
  return JSON.stringify(result);
}

function parseDevOutput(text: string): OpenCodeResult {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        summary: parsed.summary || text.slice(0, 500),
        filesChanged: parsed.filesChanged || [],
        rawText: text,
      };
    } catch {}
  }

  return {
    summary: text.slice(0, 500),
    filesChanged: [],
    rawText: text,
  };
}

function parseReviewOutput(text: string): ReviewResult {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        approved: parsed.approved ?? false,
        issues: parsed.issues || [],
        severity: parsed.severity || 'medium',
        recommendations: parsed.recommendations || [],
      };
    } catch {}
  }

  const hasIssues = /bug|issue|problem|vulnerab|missing|broken|fail|wrong|incorrect/i.test(text);
  return {
    approved: !hasIssues,
    issues: hasIssues ? ['Review found potential issues — see full review text'] : [],
    severity: hasIssues ? 'medium' : 'low',
    recommendations: [],
  };
}

function parseTestOutput(text: string): TestResult {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        allPassing: parsed.allPassing ?? false,
        totalTests: parsed.totalTests || 0,
        passed: parsed.passed || 0,
        failed: parsed.failed || 0,
        failures: parsed.failures || [],
      };
    } catch {}
  }

  const failCount = (text.match(/fail|failing|FAIL/g) || []).length;
  const passCount = (text.match(/pass|PASS|ok/g) || []).length;
  return {
    allPassing: failCount === 0,
    totalTests: failCount + passCount,
    passed: passCount,
    failed: failCount,
    failures: failCount > 0 ? ['Could not parse structured test output'] : [],
  };
}

function simulateExecution(_prompt: string, job: StoryJob): OpenCodeResult {
  return {
    summary: `[SIMULATED] Story "${job.storyPath}" would be executed by OpenCode SDK. Install @opencode-ai/sdk for real execution.`,
    filesChanged: [],
    rawText: '',
  };
}

// ── SINGLETON ────────────────────────────────────────────────

let orchestratorInstance: DevOrchestrator | null = null;

export function getOrchestrator(): DevOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new DevOrchestrator();
  }
  return orchestratorInstance;
}
