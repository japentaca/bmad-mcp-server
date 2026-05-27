import knex, { type Knex } from 'knex';
import type {
  BMADStorage, StoredDocument, WorkflowStatus,
  SearchResult, SearchQuery, HealthStatus,
} from './storage-interface.js';

interface ParsedDbUrl {
  driver: 'pg' | 'sqlite3';
  connection: string | { filename: string };
}

function parseDbUrl(url: string): ParsedDbUrl {
  if (url.startsWith('sqlite://')) {
    const filename = url.replace('sqlite://', '');
    return { driver: 'sqlite3', connection: { filename } };
  }
  // PostgreSQL or any other → pg
  return { driver: 'pg', connection: url };
}

const PG_SCHEMA = `
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS bmad_projects (
    name TEXT PRIMARY KEY,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS bmad_documents (
    id SERIAL,
    project_name TEXT NOT NULL REFERENCES bmad_projects(name) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'markdown',
    workflow TEXT,
    agent TEXT,
    version INT DEFAULT 1,
    content_tsv tsvector,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_name, id)
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS bmad_workflow_status (
    id SERIAL,
    project_name TEXT NOT NULL REFERENCES bmad_projects(name) ON DELETE CASCADE,
    workflow TEXT NOT NULL,
    status JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_name, id),
    UNIQUE (project_name, workflow)
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_docs_project_path ON bmad_documents(project_name, path);
CREATE INDEX IF NOT EXISTS idx_docs_workflow   ON bmad_documents(project_name, workflow);
CREATE INDEX IF NOT EXISTS idx_docs_search     ON bmad_documents USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS idx_status_project  ON bmad_workflow_status(project_name, workflow);
`;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS bmad_projects (
  name TEXT PRIMARY KEY,
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bmad_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL REFERENCES bmad_projects(name) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'markdown',
  workflow TEXT,
  agent TEXT,
  version INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_project_path ON bmad_documents(project_name, path);
CREATE INDEX IF NOT EXISTS idx_docs_workflow   ON bmad_documents(project_name, workflow);

CREATE TABLE IF NOT EXISTS bmad_workflow_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL REFERENCES bmad_projects(name) ON DELETE CASCADE,
  workflow TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (project_name, workflow)
);

CREATE INDEX IF NOT EXISTS idx_status_project ON bmad_workflow_status(project_name, workflow);
`;

export class KnexStorage implements BMADStorage {
  private db: Knex;
  private driver: 'pg' | 'sqlite3';
  private connStringForDb: string;
  private initialized = false;

  constructor(connString: string) {
    this.connStringForDb = connString;
    const parsed = parseDbUrl(connString);
    this.driver = parsed.driver;

    this.db = knex({
      client: parsed.driver === 'sqlite3' ? 'better-sqlite3' : 'pg',
      connection: parsed.connection as Knex.Config['connection'],
      useNullAsDefault: parsed.driver === 'sqlite3',
      pool: parsed.driver === 'sqlite3'
        ? undefined
        : { min: 1, max: 5 },
    });
  }

  getDriver(): string {
    return this.driver;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.driver === 'pg') {
      try {
        await this.ensureDatabase();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('already exists') && !msg.includes('duplicate_database')) {
          console.error('[postgres] Failed to ensure DB:', msg);
        }
      }
    }

    const schema = this.driver === 'pg' ? PG_SCHEMA : SQLITE_SCHEMA;
    if (this.driver === 'pg') {
      // Split DO blocks for PostgreSQL
      const statements = schema.split(';\n\n');
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          await this.db.raw(trimmed + ';');
        }
      }
    } else {
      // SQLite: execute each statement
      const statements = schema.split(';\n');
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (trimmed && !trimmed.startsWith('CREATE INDEX')) {
          await this.db.raw(trimmed);
        }
      }
      // Create indexes separately for SQLite
      await this.db.raw('CREATE INDEX IF NOT EXISTS idx_docs_project_path ON bmad_documents(project_name, path);').catch(() => {});
      await this.db.raw('CREATE INDEX IF NOT EXISTS idx_docs_workflow ON bmad_documents(project_name, workflow);').catch(() => {});
      await this.db.raw('CREATE INDEX IF NOT EXISTS idx_status_project ON bmad_workflow_status(project_name, workflow);').catch(() => {});
    }

    // Update PG tsvector columns after inserts (trigger-like behavior)
    if (this.driver === 'pg') {
      await this.db.raw(`
        CREATE OR REPLACE FUNCTION bmad_docs_tsv_update() RETURNS trigger AS $$
        BEGIN
          NEW.content_tsv :=
            setweight(to_tsvector('spanish', coalesce(NEW.path, '')), 'A') ||
            setweight(to_tsvector('spanish', coalesce(NEW.content, '')), 'B');
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `).catch(() => {});
      await this.db.raw(`
        DROP TRIGGER IF EXISTS bmad_docs_tsv_trigger ON bmad_documents;
        CREATE TRIGGER bmad_docs_tsv_trigger
          BEFORE INSERT OR UPDATE ON bmad_documents
          FOR EACH ROW EXECUTE FUNCTION bmad_docs_tsv_update();
      `).catch(() => {});
    }

    this.initialized = true;
    console.error(`[storage] Connected via ${this.driver}`);
  }

  private async ensureDatabase(): Promise<void> {
    const connStr = this.connStringForDb;
    const url = new URL(connStr);
    const dbName = url.pathname.replace(/^\//, '') || 'bmad_mcp';
    url.pathname = '/postgres';
    const baseConn = url.toString();

    const tempDb = knex({ client: 'pg', connection: baseConn });
    try {
      await tempDb.raw(`CREATE DATABASE "${dbName}"`);
      console.error(`[postgres] Created database: ${dbName}`);
    } finally {
      await tempDb.destroy();
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const base: HealthStatus = {
      healthy: false,
      latencyMs: 0,
      driver: this.driver === 'sqlite3' ? 'sqlite' : 'postgresql',
    };

    const start = performance.now();
    try {
      await this.db.raw('SELECT 1');
      base.healthy = true;
      base.latencyMs = Math.round((performance.now() - start) * 100) / 100;

      if (this.driver === 'pg') {
        try {
          const pool = await this.db.raw(
            "SELECT count(*) FILTER (WHERE state = 'active') AS active, count(*) FILTER (WHERE state = 'idle') AS idle FROM pg_stat_activity WHERE pid <> pg_backend_pid()",
          );
          const r = pool.rows?.[0];
          if (r) {
            base.pool = { active: Number(r.active), idle: Number(r.idle), waiting: 0 };
          }
        } catch {
          // pool stats are best-effort, don't fail health check
        }
      } else {
        base.pool = { active: 1, idle: 0, waiting: 0 };
      }
    } catch {
      // base.healthy already false
    }

    return base;
  }

  async ensureProject(projectName: string, config?: Record<string, unknown>): Promise<void> {
    const configStr = this.driver === 'pg'
      ? JSON.stringify(config || {})
      : JSON.stringify(config || {});
    await this.db('bmad_projects')
      .insert({ name: projectName, config: configStr })
      .onConflict('name')
      .merge({ config: this.db.raw('COALESCE(?, bmad_projects.config)', [configStr]) });
  }

  async saveDocument(doc: Omit<StoredDocument, 'version' | 'updatedAt'>): Promise<StoredDocument> {
    const existing = await this.db('bmad_documents')
      .where({ project_name: doc.projectName, path: doc.path })
      .orderBy('version', 'desc')
      .first();

    const version = existing ? existing.version + 1 : 1;

    const [result] = await this.db('bmad_documents')
      .insert({
        project_name: doc.projectName,
        path: doc.path,
        content: doc.content,
        content_type: doc.contentType,
        workflow: doc.workflow || null,
        agent: doc.agent || null,
        version,
        updated_at: this.db.fn.now(),
      })
      .returning(['version', 'updated_at']);

    return {
      ...doc,
      version: result.version,
      updatedAt: result.updated_at instanceof Date
        ? result.updated_at.toISOString()
        : String(result.updated_at),
    };
  }

  async readDocument(projectName: string, path: string): Promise<StoredDocument | null> {
    const row = await this.db('bmad_documents')
      .where({ project_name: projectName, path })
      .orderBy('version', 'desc')
      .first();

    if (!row) return null;
    return this.rowToDocument(row);
  }

  async listDocuments(
    projectName: string,
    filter?: { contentType?: string; workflow?: string; limit?: number; offset?: number },
  ): Promise<StoredDocument[]> {
    let query = this.db('bmad_documents')
      .where({ project_name: projectName })
      .orderBy('updated_at', 'desc')
      .limit(filter?.limit || 50)
      .offset(filter?.offset || 0);

    if (filter?.contentType) {
      query = query.where({ content_type: filter.contentType });
    }
    if (filter?.workflow) {
      query = query.where({ workflow: filter.workflow });
    }

    const rows = await query;
    return rows.map((r) => this.rowToDocument(r));
  }

  async searchDocuments(query: SearchQuery): Promise<SearchResult[]> {
    const lang = query.language || 'spanish';
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    if (!query.query.trim()) return [];

    if (this.driver === 'pg') {
      return this.pgSearch(query, lang, limit, offset);
    }
    return this.sqliteSearch(query, limit, offset);
  }

  private async pgSearch(
    query: SearchQuery,
    lang: string,
    limit: number,
    offset: number,
  ): Promise<SearchResult[]> {
    const cleanQuery = query.query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => w + ':*')
      .join(' & ');

    if (!cleanQuery) return [];

    const conditions: string[] = ['project_name = ?'];
    const bindings: (string | number)[] = [query.projectName];

    if (query.contentType) {
      conditions.push('content_type = ?');
      bindings.push(query.contentType);
    }
    if (query.workflow) {
      conditions.push('workflow = ?');
      bindings.push(query.workflow);
    }

    const where = conditions.join(' AND ');
    const headBindings: (string | number)[] = [lang, cleanQuery, lang, lang, cleanQuery];

    const sql = `
      SELECT path, content_type, updated_at,
             ts_rank(content_tsv, to_tsquery(?::regconfig, ?)) AS score,
             ts_headline(?::regconfig, content, to_tsquery(?::regconfig, ?),
               'MaxWords=30, MinWords=10, StartSel=<mark>, StopSel=</mark>') AS snippet
      FROM bmad_documents
      WHERE ${where}
      ORDER BY score DESC
      LIMIT ? OFFSET ?
    `;

    const allBindings: (string | number)[] = [...headBindings, ...bindings, limit, offset];
    const rows = await this.db.raw(sql, allBindings);

    return rows.rows.map((r: Record<string, unknown>) => ({
      path: String(r.path),
      score: parseFloat(String(r.score)),
      snippet: String(r.snippet),
      contentType: String(r.content_type),
      updatedAt: r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
    }));
  }

  private async sqliteSearch(
    query: SearchQuery,
    limit: number,
    offset: number,
  ): Promise<SearchResult[]> {
    const searchTerm = `%${query.query}%`;
    let q = this.db('bmad_documents')
      .where({ project_name: query.projectName })
      .where(function () {
        this.where('content', 'like', searchTerm)
          .orWhere('path', 'like', searchTerm);
      })
      .orderBy('updated_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (query.contentType) {
      q = q.where({ content_type: query.contentType });
    }
    if (query.workflow) {
      q = q.where({ workflow: query.workflow });
    }

    const rows = await q;

    return rows.map((r) => {
      const idx = r.content.indexOf(query.query);
      const start = Math.max(0, idx - 40);
      const end = Math.min(r.content.length, idx + query.query.length + 40);
      return {
        path: r.path,
        score: idx >= 0 ? 0.7 : 0.3,
        snippet: (start > 0 ? '...' : '') + r.content.slice(start, end) + (end < r.content.length ? '...' : ''),
        contentType: r.content_type,
        updatedAt: r.updated_at,
      };
    });
  }

  async saveWorkflowStatus(status: WorkflowStatus): Promise<WorkflowStatus> {
    const statusStr = typeof status.status === 'string'
      ? status.status
      : JSON.stringify(status.status);

    await this.db('bmad_workflow_status')
      .insert({
        project_name: status.projectName,
        workflow: status.workflow,
        status: statusStr,
        updated_at: this.db.fn.now(),
      })
      .onConflict(['project_name', 'workflow'])
      .merge({
        status: statusStr,
        updated_at: this.db.fn.now(),
      });

    const row = await this.db('bmad_workflow_status')
      .where({ project_name: status.projectName, workflow: status.workflow })
      .first();

    return {
      ...status,
      updatedAt: row?.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row?.updated_at || new Date().toISOString()),
    };
  }

  async readWorkflowStatus(projectName: string, workflow: string): Promise<WorkflowStatus | null> {
    const row = await this.db('bmad_workflow_status')
      .where({ project_name: projectName, workflow })
      .first();

    if (!row) return null;

    return {
      projectName: row.project_name,
      workflow: row.workflow,
      status: typeof row.status === 'string' ? JSON.parse(row.status) : row.status,
      updatedAt: row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
    };
  }

  async listWorkflowStatuses(projectName: string): Promise<WorkflowStatus[]> {
    const rows = await this.db('bmad_workflow_status')
      .where({ project_name: projectName })
      .orderBy('updated_at', 'desc');

    return rows.map((r) => ({
      projectName: r.project_name,
      workflow: r.workflow,
      status: typeof r.status === 'string' ? JSON.parse(r.status) : r.status,
      updatedAt: r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
    }));
  }

  private rowToDocument(r: Record<string, unknown>): StoredDocument {
    return {
      projectName: String(r.project_name),
      path: String(r.path),
      content: String(r.content),
      contentType: String(r.content_type || 'markdown'),
      workflow: r.workflow ? String(r.workflow) : undefined,
      agent: r.agent ? String(r.agent) : undefined,
      version: Number(r.version),
      updatedAt: r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
    };
  }
}
