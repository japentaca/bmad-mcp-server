import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';

export const GET: APIRoute = async ({ params }) => {
  const name = params.name;
  if (!name) return new Response(JSON.stringify({ error: 'Project name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const db = getDb();
  await db.initialize();

  type Row = Record<string, unknown>;
  const statuses = await db.query('bmad_workflow_status')
    .where('project_name', name)
    .select('workflow', 'status', 'updated_at')
    .orderBy('updated_at', 'desc') as Row[];

  return new Response(JSON.stringify(statuses), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
