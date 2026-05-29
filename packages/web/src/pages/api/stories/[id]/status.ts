import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';
import { getOrchestrator } from '@lib/dev';

export const GET: APIRoute = async ({ params, url }) => {
  const projectName = url.searchParams.get('projectName');
  const storyPath = url.searchParams.get('storyPath');

  try {
    if (projectName && storyPath) {
      const db = getDb();
      await db.initialize();
      const status = await db.readWorkflowStatus(projectName, storyPath);

      return new Response(
        JSON.stringify({
          workflowStatus: status?.status || { step: 'created' },
          updatedAt: status?.updatedAt || null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const orchestrator = getOrchestrator();
    const jobId = params.id;
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Provide jobId or projectName+storyPath' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const job = orchestrator.getJob(jobId);
    if (!job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(job),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
