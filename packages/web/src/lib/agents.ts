import fs from 'node:fs';
import path from 'node:path';

export interface AgentMeta {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  module: string;
  role: string;
  path: string;
}

function parseAgentFrontmatter(content: string, filePath: string, moduleName: string): AgentMeta | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const get = (key: string) => {
    const m = fm.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };

  const filename = path.basename(filePath, '.md');
  return {
    name: filename,
    displayName: get('name') || filename,
    title: get('description') || '',
    icon: get('icon') || 'pi pi-android',
    module: moduleName,
    role: get('role') || 'agent',
    path: filePath,
  };
}

let cachedAgents: AgentMeta[] | null = null;

export function getAllAgents(): AgentMeta[] {
  if (cachedAgents) return cachedAgents;

  const results: AgentMeta[] = [];

  const bundlePath = path.resolve(process.cwd(), '../../bmad-bundle');
  if (fs.existsSync(bundlePath)) {
    console.error('[agents] Scanning bmad-bundle directory');
    const directAgents = path.join(bundlePath, 'agents');
    if (fs.existsSync(directAgents)) {
      const files = fs.readdirSync(directAgents);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const filePath = path.join(directAgents, f);
          const content = fs.readFileSync(filePath, 'utf-8');
          const meta = parseAgentFrontmatter(content, filePath, 'core');
          if (meta) results.push(meta);
        }
      }
    }

    // Scan module subdirectories
    const moduleDirs = fs.readdirSync(bundlePath, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'agents' && e.name !== 'core');

    for (const mod of moduleDirs) {
      const agentsDir = path.join(bundlePath, mod.name, 'agents');
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        for (const f of files) {
          if (f.endsWith('.md')) {
            const filePath = path.join(agentsDir, f);
            const content = fs.readFileSync(filePath, 'utf-8');
            const meta = parseAgentFrontmatter(content, filePath, mod.name);
            if (meta) results.push(meta);
          }
        }
      }
    }
  }

  cachedAgents = results;
  return results;
}

export async function readAgentSource(agentName: string, _module?: string): Promise<string | null> {
  const bundlePath = path.resolve(process.cwd(), '../../bmad-bundle');
  if (!fs.existsSync(bundlePath)) return null;

  const searchDirs: string[] = [
    path.join(bundlePath, 'agents'),
  ];

  const moduleDirs = fs.readdirSync(bundlePath, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'agents' && e.name !== 'core');

  for (const mod of moduleDirs) {
    searchDirs.push(path.join(bundlePath, mod.name, 'agents'));
  }

  for (const dir of searchDirs) {
    const filePath = path.join(dir, `${agentName}.md`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  return null;
}
