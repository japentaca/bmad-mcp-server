/**
 * BMAD Source Adapter - Reads bmad-method source structure and maps it
 * to the agent/workflow format expected by ResourceLoaderGit.
 *
 * Handles the bmad-method source format:
 * - src/{module}-skills/{phase}/{skill-name}/customize.toml  (agent persona)
 * - src/{module}-skills/{phase}/{skill-name}/SKILL.md         (activation instructions)
 * - src/{module}-skills/module-help.csv                       (workflow listing)
 * - src/{module}-skills/module.yaml                           (agent roster, config)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  parseSimpleToml,
  getTomlSection,
  getTomlString,
  getTomlStringArray,
  getTomlTableArray,
} from '../utils/toml-parser.js';
import type { AgentMetadata } from './resource-loader.js';
import type { Workflow } from '../types/index.js';

const AGENT_DIR_PATTERN = /bmad-agent-/i;

export interface BmadSourceAdapterResult {
  agents: AgentMetadata[];
  workflows: Workflow[];
}

/**
 * Detects if a directory is a bmad-method source structure.
 * Looks for {dir}/src/bmm-skills/ or {dir}/src/core-skills/
 */
export function isBmadMethodSource(dir: string): boolean {
  const skillsDirs = ['bmm-skills', 'core-skills'];
  for (const skills of skillsDirs) {
    const srcSkills = join(dir, 'src', skills);
    const topSkills = join(dir, skills);
    if (existsSync(srcSkills) || existsSync(topSkills)) {
      return true;
    }
  }
  return false;
}

/**
 * Scan bmad-method source for agents and workflows.
 */
export function scanBmadMethodSource(
  sourceDir: string,
  moduleMap: string[] = ['bmm', 'core'],
): BmadSourceAdapterResult {
  const result: BmadSourceAdapterResult = {
    agents: [],
    workflows: [],
  };

  for (const moduleName of moduleMap) {
    const skillsDir = findSkillsDir(sourceDir, moduleName);
    if (!skillsDir) continue;

    // Extract agents
    const agents = extractAgentsFromModule(skillsDir, moduleName);
    result.agents.push(...agents);

    // Extract workflows
    const workflows = extractWorkflowsFromModule(skillsDir, moduleName);
    result.workflows.push(...workflows);
  }

  return result;
}

function findSkillsDir(sourceDir: string, moduleName: string): string | null {
  const candidates = [
    join(sourceDir, 'src', `${moduleName}-skills`),
    join(sourceDir, `${moduleName}-skills`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function extractAgentsFromModule(
  skillsDir: string,
  moduleName: string,
): AgentMetadata[] {
  const agents: AgentMetadata[] = [];

  if (!existsSync(skillsDir)) return agents;

  walkDir(skillsDir, (fullPath, isDir, name) => {
    if (!isDir) return;
    if (!AGENT_DIR_PATTERN.test(name)) return;

    const agentMeta = readAgentFromDir(fullPath, moduleName);
    if (agentMeta) {
      agents.push(agentMeta);
    }
  });

  return agents;
}

function readAgentFromDir(
  dir: string,
  moduleName: string,
): AgentMetadata | null {
  const tomlPath = join(dir, 'customize.toml');
  if (!existsSync(tomlPath)) return null;

  try {
    const tomlContent = readFileSync(tomlPath, 'utf-8');
    const doc = parseSimpleToml(tomlContent);
    const agent = getTomlSection(doc, 'agent');

    const name = getTomlString(agent, 'name');
    const title = getTomlString(agent, 'title');
    const role = getTomlString(agent, 'role');
    const identity = getTomlString(agent, 'identity');
    const style = getTomlString(agent, 'communication_style');
    const principlesArr = getTomlStringArray(agent, 'principles');
    const icon = getTomlString(agent, 'icon', '🤖');

    if (!name) return null;

    const agentName = basename(dir).replace('bmad-agent-', '');

    // Parse menu items for workflows
    const menuItems: string[] = [];
    const workflowNames: string[] = [];
    const menuEntries = getTomlTableArray(doc, 'agent.menu');
    for (const entry of menuEntries) {
      const code = getTomlString(entry, 'code');
      const desc = getTomlString(entry, 'description');
      const skillName = getTomlString(entry, 'skill');
      if (code) {
        menuItems.push(`${code} - ${desc || code}`);
      }
      if (skillName) {
        workflowNames.push(skillName);
      }
    }

    // Read SKILL.md for full content
    let content = '';
    const skillPath = join(dir, 'SKILL.md');
    if (existsSync(skillPath)) {
      content = readFileSync(skillPath, 'utf-8');
    }

    const meta: AgentMetadata = {
      name: agentName,
      title: title || agentName,
      displayName: name,
      module: moduleName,
      description: role,
      persona: identity,
      capabilities: [],
      menuItems: menuItems.slice(0, 8),
      workflows: [...new Set(workflowNames)],
      icon: icon || undefined,
      communicationStyle: style || undefined,
      principles: principlesArr.length > 0
        ? principlesArr.join('; ')
        : undefined,
    };

    return meta;
  } catch (err) {
    throw new Error(
      `Failed to read agent from ${dir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function extractWorkflowsFromModule(
  skillsDir: string,
  moduleName: string,
): Workflow[] {
  const workflows: Workflow[] = [];
  const seen = new Set<string>();

  // Try reading module-help.csv for workflow descriptions
  const helpCsvPath = join(skillsDir, 'module-help.csv');
  const helpMap = new Map<string, string>();
  if (existsSync(helpCsvPath)) {
    try {
      const csvContent = readFileSync(helpCsvPath, 'utf-8');
      const records: Array<Record<string, string>> = parseCsv(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: true,
      });
      for (const r of records) {
        const skill = r.skill || '';
        const desc = r.description || '';
        if (skill && !skill.startsWith('_') && skill !== 'skill') {
          helpMap.set(skill, desc);
        }
      }
    } catch (err) {
      throw new Error(
        `Failed to parse CSV ${helpCsvPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Walk directories to find non-agent skills
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Sub-directories for phases
      const phaseDir = join(skillsDir, entry.name);
      if (!statSync(phaseDir).isDirectory()) continue;

      try {
        const skillEntries = readdirSync(phaseDir, { withFileTypes: true });
        for (const se of skillEntries) {
          if (!se.isDirectory()) continue;
          if (AGENT_DIR_PATTERN.test(se.name)) continue;

          const skillName = se.name;
          if (seen.has(skillName)) continue;
          seen.add(skillName);

          const desc = helpMap.get(skillName) || '';

          workflows.push({
            name: skillName,
            description: desc,
            module: moduleName,
            path: '',
            standalone: true,
          });
        }
      } catch (err) {
        throw new Error(
          `Failed to scan phase directory ${phaseDir}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Add entries from helpMap not already covered
  for (const [skill, desc] of helpMap) {
    if (!seen.has(skill)) {
      seen.add(skill);
      workflows.push({
        name: skill,
        description: desc,
        module: moduleName,
        path: '',
        standalone: true,
      });
    }
  }

  return workflows;
}

function walkDir(
  dir: string,
  visitor: (fullPath: string, isDir: boolean, name: string) => void,
): void {
  if (!existsSync(dir)) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const fullPath = join(dir, entry.name);
        visitor(fullPath, true, entry.name);
        walkDir(fullPath, visitor);
      }
    }
  } catch (err) {
    throw new Error(
      `Failed to walk directory ${dir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
