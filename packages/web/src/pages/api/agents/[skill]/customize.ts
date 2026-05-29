import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const CUSTOM_DIR = process.env.BMAD_CUSTOM_DIR || path.resolve(process.cwd(), '_bmad', 'custom');

export const GET: APIRoute = async ({ params, url }) => {
  const skill = params.skill;
  if (!skill) return json({ error: 'Skill name required' }, 400);

  const layer = url.searchParams.get('layer') || 'team';
  const filename = layer === 'user' ? `${skill}.user.toml` : `${skill}.toml`;
  const filePath = path.join(CUSTOM_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return json({ content: null, path: filePath }, 404);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return json({ content, path: filePath }, 200);
  } catch {
    return json({ error: 'Failed to read file' }, 500);
  }
};

export const PUT: APIRoute = async ({ params, request, url }) => {
  const skill = params.skill;
  if (!skill) return json({ error: 'Skill name required' }, 400);

  const layer = url.searchParams.get('layer') || 'team';
  const filename = layer === 'user' ? `${skill}.user.toml` : `${skill}.toml`;
  const filePath = path.join(CUSTOM_DIR, filename);

  try {
    const body = await request.json();
    if (typeof body.content !== 'string') {
      return json({ error: 'content field required' }, 400);
    }

    fs.mkdirSync(CUSTOM_DIR, { recursive: true });
    fs.writeFileSync(filePath, body.content, 'utf-8');
    return json({ saved: true, path: filePath }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
