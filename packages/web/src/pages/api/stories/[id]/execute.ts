import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';
import { getOrchestrator } from '@lib/dev';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { projectName, storyId, storyPath } = body;

    if (!projectName || !storyId || !storyPath) {
      return new Response(
        JSON.stringify({ error: 'projectName, storyId, and storyPath are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const db = getDb();
    await db.initialize();

    const doc = await db.readDocument(projectName, storyPath);
    if (!doc) {
      return new Response(
        JSON.stringify({ error: `Story not found: ${storyPath}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const orchestrator = getOrchestrator();
    const jobId = orchestrator.enqueue(projectName, Number(storyId), storyPath);

    return new Response(
      JSON.stringify({ jobId, status: 'queued', storyPath }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
