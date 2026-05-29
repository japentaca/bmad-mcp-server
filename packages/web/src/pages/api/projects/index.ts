import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';

export const GET: APIRoute = async () => {
  const db = getDb();
  await db.initialize();

  type Row = Record<string, unknown>;
  const projects = await db.query('bmad_projects').select('name', 'config', 'created_at').orderBy('created_at', 'desc') as Row[];

  return new Response(JSON.stringify(projects), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDb();
  await db.initialize();

  try {
    const body = await request.json();
    const { name, config } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Project name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.ensureProject(name, config);
    return new Response(JSON.stringify({ name, config: config || {} }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
