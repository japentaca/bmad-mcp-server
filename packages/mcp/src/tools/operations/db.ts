/**
 * BMAD DB Operation
 *
 * Persists Documents, workflow status, and full-text search in PostgreSQL.
 *
 * Operations:
 * - save: Save a document to DB
 * - read: Read a document from DB
 * - list: List documents for the project
 * - search: Full-text search across documents
 * - status: Save/read workflow status
 */

import type { BMADStorage } from '../../storage/storage-interface.js';

export interface DBParams {
  action: 'save' | 'read' | 'list' | 'search' | 'status-save' | 'status-read' | 'status-list';
  projectName?: string;
  path?: string;
  content?: string;
  contentType?: string;
  workflow?: string;
  agent?: string;
  query?: string;
  language?: string;
  limit?: number;
  offset?: number;
  status?: Record<string, unknown>;
}

export interface DBResult {
  success: boolean;
  data?: unknown;
  error?: string;
  text: string;
}

export async function executeDBOperation(
  storage: BMADStorage,
  params: DBParams,
): Promise<DBResult> {
  const projectName = params.projectName || 'default';

  try {
    switch (params.action) {
      case 'save': {
        if (!params.path || !params.content) {
          return { success: false, error: 'path and content are required for save', text: '' };
        }
        const doc = await storage.saveDocument({
          projectName,
          path: params.path,
          content: params.content,
          contentType: params.contentType || 'markdown',
          workflow: params.workflow,
          agent: params.agent,
        });
        return {
          success: true,
          data: doc,
          text: `Document saved: ${doc.path} (v${doc.version})`,
        };
      }

      case 'read': {
        if (!params.path) {
          return { success: false, error: 'path is required for read', text: '' };
        }
        const doc = await storage.readDocument(projectName, params.path);
        if (!doc) {
          return { success: false, error: `Document not found: ${params.path}`, text: '' };
        }
        return {
          success: true,
          data: doc,
          text: `\`\`\`${doc.contentType}\n${doc.content}\n\`\`\``,
        };
      }

      case 'list': {
        const docs = await storage.listDocuments(projectName, {
          contentType: params.contentType,
          workflow: params.workflow,
          limit: params.limit || 50,
          offset: params.offset || 0,
        });
        const list = docs.map((d) => ({
          path: d.path,
          type: d.contentType,
          workflow: d.workflow,
          version: d.version,
          updated: d.updatedAt,
        }));
        return {
          success: true,
          data: list,
          text: `Documents for project "${projectName}" (${list.length}):\n${list.map((d) => `  ${d.path} [v${d.version}]`).join('\n')}`,
        };
      }

      case 'search': {
        if (!params.query) {
          return { success: false, error: 'query is required for search', text: '' };
        }
        const results = await storage.searchDocuments({
          projectName,
          query: params.query,
          language: params.language || 'spanish',
          contentType: params.contentType,
          workflow: params.workflow,
          limit: params.limit || 20,
          offset: params.offset || 0,
        });
        return {
          success: true,
          data: results,
          text: results.length > 0
            ? results.map((r) => `[${r.score.toFixed(2)}] ${r.path}: ${r.snippet}`).join('\n')
            : `No results for "${params.query}"`,
        };
      }

      case 'status-save': {
        if (!params.workflow || !params.status) {
          return { success: false, error: 'workflow and status are required', text: '' };
        }
        const st = await storage.saveWorkflowStatus({
          projectName,
          workflow: params.workflow,
          status: params.status,
          updatedAt: new Date().toISOString(),
        });
        return {
          success: true,
          data: st,
          text: `Status saved for workflow "${params.workflow}"`,
        };
      }

      case 'status-read': {
        if (!params.workflow) {
          return { success: false, error: 'workflow is required', text: '' };
        }
        const st = await storage.readWorkflowStatus(projectName, params.workflow);
        if (!st) {
          return { success: false, error: `Status not found for workflow "${params.workflow}"`, text: '' };
        }
        return {
          success: true,
          data: st,
          text: JSON.stringify(st.status, null, 2),
        };
      }

      case 'status-list': {
        const statuses = await storage.listWorkflowStatuses(projectName);
        return {
          success: true,
          data: statuses,
          text: statuses.map((s) => `${s.workflow}: updated ${s.updatedAt}`).join('\n'),
        };
      }

      default:
        return { success: false, error: `Unknown action: ${params.action}`, text: '' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      text: `DB operation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function validateDBParams(params: unknown): string | undefined {
  if (!params || typeof params !== 'object') return 'Parameters must be an object';
  const p = params as Partial<DBParams>;
  if (!p.action) return 'Missing required parameter: action';
  const validActions = ['save', 'read', 'list', 'search', 'status-save', 'status-read', 'status-list'];
  if (!validActions.includes(p.action)) {
    return `Invalid action: ${p.action}. Must be one of: ${validActions.join(', ')}`;
  }
  return undefined;
}

export function getDBExamples(): string[] {
  return [
    'Save: { operation: "db", db: { action: "save", path: "prd/checkout.md", content: "..." } }',
    'Read: { operation: "db", db: { action: "read", path: "prd/checkout.md" } }',
    'List: { operation: "db", db: { action: "list", projectName: "my-app" } }',
    'Search: { operation: "db", db: { action: "search", query: "pago con tarjeta", language: "spanish" } }',
    'Status: { operation: "db", db: { action: "status-read" }, workflow: "prd" }',
    'Status save: { operation: "db", db: { action: "status-save", status: {...} }, workflow: "sprint-status" }',
  ];
}
