import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';

export const GET: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name) return new Response(JSON.stringify({ error: 'Project name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const db = getDb();
  await db.initialize();

  type Row = Record<string, unknown>;
  const project = await db.query('bmad_projects').where('name', name).first() as Row | undefined;
  if (!project) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify(project), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params }) => {
  const { name } = params;
  if (!name) return new Response(JSON.stringify({ error: 'Project name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const db = getDb();
  await db.initialize();

  await db.query('bmad_workflow_status').where('project_name', name).del();
  await db.query('bmad_documents').where('project_name', name).del();
  await db.query('bmad_projects').where('name', name).del();

  return new Response(JSON.stringify({ deleted: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
