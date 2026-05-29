import type { APIRoute } from 'astro';
import { getDb } from '@lib/db';

export const GET: APIRoute = async ({ params, url }) => {
  const name = params.name;
  if (!name) return new Response(JSON.stringify({ error: 'Project name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const db = getDb();
  await db.initialize();

  const contentType = url.searchParams.get('contentType') || undefined;
  const workflow = url.searchParams.get('workflow') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  type Row = Record<string, unknown>;
  const docs = await db.query('bmad_documents')
    .where('project_name', name)
    .modify((qb: any) => {
      if (contentType) qb.where('content_type', contentType);
      if (workflow) qb.where('workflow', workflow);
    })
    .select('id', 'path', 'content_type', 'workflow', 'agent', 'version', 'updated_at')
    .orderBy('updated_at', 'desc')
    .limit(limit)
    .offset(offset) as Row[];

  return new Response(JSON.stringify(docs), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
