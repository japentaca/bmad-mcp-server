import knex, { type Knex } from 'knex';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  BMADStorage, StoredDocument, WorkflowStatus,
  SearchResult, SearchQuery, HealthStatus,
  ActivityLogEntry, ActivityLogFilter, ActivityLogPage, ActivityStats,
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
  return { driver: 'pg', connection: url };
}

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

  query(table: string): Knex.QueryBuilder {
    return this.db(table);
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

    const __filename = fileURLToPath(import.meta.url);
    const migrationsDir = join(dirname(__filename), 'migrations');
    const isTS = __filename.endsWith('.ts');

    await this.db.migrate.latest({
      directory: migrationsDir,
      extension: isTS ? 'ts' : 'js',
      tableName: 'knex_migrations',
    });

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
        }
      } else {
        base.pool = { active: 1, idle: 0, waiting: 0 };
      }
    } catch {
    }

    return base;
  }

  async ensureProject(projectName: string, config?: Record<string, unknown>): Promise<void> {
    const configStr = JSON.stringify(config || {});
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

  async insertActivityLog(entry: ActivityLogEntry): Promise<void> {
    const row: Record<string, unknown> = {
      level: entry.level || 'info',
      category: entry.category || 'system',
      action: entry.action,
      entity_type: entry.entity_type || null,
      entity_name: entry.entity_name || null,
      project: entry.project || null,
      module: entry.module || null,
      user_message: entry.user_message || null,
      request_body: entry.request_body || null,
      response_summary: entry.response_summary || null,
      response_size: entry.response_size || null,
      duration_ms: entry.duration_ms || null,
      success: entry.success !== undefined ? entry.success : true,
      error_code: entry.error_code || null,
      error_message: entry.error_message || null,
      session_id: entry.session_id || null,
      client_id: entry.client_id || null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : '{}',
      timestamp: entry.timestamp || this.db.fn.now(),
    };

    await this.db('bmad_activity_log').insert(row);
  }

  async queryActivityLogs(filter: ActivityLogFilter): Promise<ActivityLogPage> {
    const page = filter.page || 1;
    const pageSize = filter.page_size || 50;
    const offset = (page - 1) * pageSize;
    const sortField = filter.sort_field || 'timestamp';
    const sortOrder = filter.sort_order || 'desc';

    let q = this.db('bmad_activity_log');
    let countQ = this.db('bmad_activity_log');

    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      q = q.whereIn('level', levels);
      countQ = countQ.whereIn('level', levels);
    }
    if (filter.category) {
      const cats = Array.isArray(filter.category) ? filter.category : [filter.category];
      q = q.whereIn('category', cats);
      countQ = countQ.whereIn('category', cats);
    }
    if (filter.action) {
      q = q.where('action', filter.action);
      countQ = countQ.where('action', filter.action);
    }
    if (filter.entity_type) {
      q = q.where('entity_type', filter.entity_type);
      countQ = countQ.where('entity_type', filter.entity_type);
    }
    if (filter.entity_name) {
      q = q.where('entity_name', filter.entity_name);
      countQ = countQ.where('entity_name', filter.entity_name);
    }
    if (filter.project) {
      q = q.where('project', filter.project);
      countQ = countQ.where('project', filter.project);
    }
    if (filter.module) {
      q = q.where('module', filter.module);
      countQ = countQ.where('module', filter.module);
    }
    if (filter.success !== undefined) {
      q = q.where('success', filter.success);
      countQ = countQ.where('success', filter.success);
    }
    if (filter.date_from) {
      q = q.where('timestamp', '>=', filter.date_from);
      countQ = countQ.where('timestamp', '>=', filter.date_from);
    }
    if (filter.date_to) {
      q = q.where('timestamp', '<=', filter.date_to);
      countQ = countQ.where('timestamp', '<=', filter.date_to);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      q = q.where(function () {
        this.where('action', 'like', term)
          .orWhere('entity_name', 'like', term)
          .orWhere('project', 'like', term)
          .orWhere('user_message', 'like', term)
          .orWhere('error_message', 'like', term);
      });
      countQ = countQ.where(function () {
        this.where('action', 'like', term)
          .orWhere('entity_name', 'like', term)
          .orWhere('project', 'like', term)
          .orWhere('user_message', 'like', term)
          .orWhere('error_message', 'like', term);
      });
    }

    const [{ count: totalCount }] = await countQ.count('* as count');
    const total = Number(totalCount);

    const rows = await q
      .orderBy(sortField, sortOrder)
      .limit(pageSize)
      .offset(offset);

    return {
      rows: rows as unknown as ActivityLogEntry[],
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    };
  }

  async getActivityStats(date_from?: string, date_to?: string): Promise<ActivityStats> {
    let baseQ = this.db('bmad_activity_log');
    if (date_from) baseQ = baseQ.where('timestamp', '>=', date_from);
    if (date_to) baseQ = baseQ.where('timestamp', '<=', date_to);

    const totalResult = await baseQ.clone().count('* as count').first();
    const total = Number(totalResult?.count || 0);

    const byCategory = await baseQ.clone()
      .select('category')
      .count('* as count')
      .groupBy('category');
    const bc: Record<string, number> = {};
    for (const r of byCategory as Record<string, unknown>[]) {
      bc[String(r.category)] = Number(r.count);
    }

    const byLevel = await baseQ.clone()
      .select('level')
      .count('* as count')
      .groupBy('level');
    const bl: Record<string, number> = {};
    for (const r of byLevel as Record<string, unknown>[]) {
      bl[String(r.level)] = Number(r.count);
    }

    const succResult = await baseQ.clone().where('success', true).count('* as count').first();
    const errResult = await baseQ.clone().where('success', false).count('* as count').first();

    const avgResult = await baseQ.clone()
      .whereNotNull('duration_ms')
      .avg('duration_ms as avg_ms')
      .first();
    const avgMs = Math.round(Number(avgResult?.avg_ms || 0));

    let dailyQ = this.db('bmad_activity_log');
    if (date_from) dailyQ = dailyQ.where('timestamp', '>=', date_from);
    if (date_to) dailyQ = dailyQ.where('timestamp', '<=', date_to);

    const isPG = this.driver === 'pg';
    const dateExpr = isPG
      ? this.db.raw("DATE(timestamp) as date")
      : this.db.raw("DATE(timestamp) as date");

    const daily = await dailyQ
      .select(dateExpr)
      .count('* as count')
      .groupByRaw(isPG ? 'DATE(timestamp)' : 'DATE(timestamp)')
      .orderBy('date', 'asc')
      .limit(90);

    const dailyTimeline = (daily as Record<string, unknown>[]).map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    }));

    const top = await baseQ.clone()
      .select('entity_name', 'entity_type')
      .count('* as count')
      .whereNotNull('entity_name')
      .groupBy('entity_name', 'entity_type')
      .orderBy('count', 'desc')
      .limit(20);

    const topEntities = (top as Record<string, unknown>[]).map((r) => ({
      entity_name: String(r.entity_name),
      entity_type: String(r.entity_type),
      count: Number(r.count),
    }));

    return {
      total_activities: total,
      by_category: bc,
      by_level: bl,
      success_count: Number(succResult?.count || 0),
      error_count: Number(errResult?.count || 0),
      avg_duration_ms: avgMs,
      daily_timeline: dailyTimeline,
      top_entities: topEntities,
      error_by_entity: await this.getErrorByEntity(baseQ),
      duration_histogram: await this.getDurationHistogram(baseQ),
      hourly_heatmap: await this.getHourlyHeatmap(baseQ),
      error_timeline: await this.getErrorTimeline(date_from, date_to),
      by_project: await this.getByProject(baseQ),
      top_errors: await this.getTopErrors(baseQ),
    };
  }

  private async getErrorByEntity(baseQ: Knex.QueryBuilder): Promise<Array<{ entity_name: string; entity_type: string; error_count: number; total_count: number; error_rate: number }>> {
    const errorCounts = await baseQ.clone()
      .select('entity_name', 'entity_type')
      .count('* as error_count')
      .where('success', false)
      .whereNotNull('entity_name')
      .groupBy('entity_name', 'entity_type')
      .orderBy('error_count', 'desc')
      .limit(15) as Record<string, unknown>[];

    const totalCounts = await baseQ.clone()
      .select('entity_name', 'entity_type')
      .count('* as total_count')
      .whereNotNull('entity_name')
      .groupBy('entity_name', 'entity_type') as Record<string, unknown>[];

    const totalMap = new Map<string, number>();
    for (const r of totalCounts) {
      totalMap.set(`${r.entity_name}|${r.entity_type}`, Number(r.total_count));
    }

    return errorCounts.map((r) => {
      const total = totalMap.get(`${r.entity_name}|${r.entity_type}`) || 0;
      return {
        entity_name: String(r.entity_name),
        entity_type: String(r.entity_type),
        error_count: Number(r.error_count),
        total_count: total,
        error_rate: total > 0 ? Math.round((Number(r.error_count) / total) * 10000) / 100 : 0,
      };
    });
  }

  private async getDurationHistogram(baseQ: Knex.QueryBuilder): Promise<Array<{ bucket: string; min_ms: number; max_ms: number | null; count: number }>> {
    const buckets = [
      { bucket: '0-100ms', min: 0, max: 100 },
      { bucket: '100-250ms', min: 100, max: 250 },
      { bucket: '250-500ms', min: 250, max: 500 },
      { bucket: '500ms-1s', min: 500, max: 1000 },
      { bucket: '1-2s', min: 1000, max: 2000 },
      { bucket: '2-5s', min: 2000, max: 5000 },
      { bucket: '5-10s', min: 5000, max: 10000 },
      { bucket: '10-30s', min: 10000, max: 30000 },
      { bucket: '>30s', min: 30000, max: null },
    ];

    const results: Array<{ bucket: string; min_ms: number; max_ms: number | null; count: number }> = [];

    for (const b of buckets) {
      let q = baseQ.clone().whereNotNull('duration_ms');
      q = q.where('duration_ms', '>=', b.min);
      if (b.max !== null) {
        q = q.where('duration_ms', '<', b.max);
      }
      const result = await q.count('* as count').first();
      results.push({ bucket: b.bucket, min_ms: b.min, max_ms: b.max, count: Number(result?.count || 0) });
    }

    return results;
  }

  private async getHourlyHeatmap(baseQ: Knex.QueryBuilder): Promise<Array<{ day: number; hour: number; count: number }>> {
    const isPG = this.driver === 'pg';
    const hourExpr = isPG
      ? this.db.raw("EXTRACT(HOUR FROM timestamp)::int as hour")
      : this.db.raw("CAST(strftime('%H', timestamp) AS INTEGER) as hour");
    const dayExpr = isPG
      ? this.db.raw("EXTRACT(DOW FROM timestamp)::int as day")
      : this.db.raw("CAST(strftime('%w', timestamp) AS INTEGER) as day");

    const rows = await baseQ.clone()
      .select(hourExpr, dayExpr)
      .count('* as count')
      .groupByRaw(isPG ? 'EXTRACT(HOUR FROM timestamp), EXTRACT(DOW FROM timestamp)' : "strftime('%H', timestamp), strftime('%w', timestamp)")
      .orderByRaw(isPG ? 'EXTRACT(DOW FROM timestamp), EXTRACT(HOUR FROM timestamp)' : "strftime('%w', timestamp), strftime('%H', timestamp)") as Record<string, unknown>[];

    return rows.map((r) => ({
      day: Number(r.day),
      hour: Number(r.hour),
      count: Number(r.count),
    }));
  }

  private async getErrorTimeline(date_from?: string, date_to?: string): Promise<Array<{ date: string; error_count: number }>> {
    let q = this.db('bmad_activity_log').where('success', false);
    if (date_from) q = q.where('timestamp', '>=', date_from);
    if (date_to) q = q.where('timestamp', '<=', date_to);

    const isPG = this.driver === 'pg';
    const dateExpr = this.db.raw(isPG ? "DATE(timestamp) as date" : "DATE(timestamp) as date");

    const rows = await q
      .select(dateExpr)
      .count('* as error_count')
      .groupByRaw(isPG ? 'DATE(timestamp)' : 'DATE(timestamp)')
      .orderBy('date', 'asc')
      .limit(90) as Record<string, unknown>[];

    return rows.map((r) => ({
      date: String(r.date),
      error_count: Number(r.error_count),
    }));
  }

  private async getByProject(baseQ: Knex.QueryBuilder): Promise<Array<{ project: string; count: number; error_count: number }>> {
    const total = await baseQ.clone()
      .select('project')
      .count('* as count')
      .whereNotNull('project')
      .groupBy('project')
      .orderBy('count', 'desc')
      .limit(15) as Record<string, unknown>[];

    const errors = await baseQ.clone()
      .select('project')
      .count('* as error_count')
      .whereNotNull('project')
      .where('success', false)
      .groupBy('project') as Record<string, unknown>[];

    const errorMap = new Map<string, number>();
    for (const r of errors) {
      errorMap.set(String(r.project), Number(r.error_count));
    }

    return total.map((r) => ({
      project: String(r.project),
      count: Number(r.count),
      error_count: errorMap.get(String(r.project)) || 0,
    }));
  }

  private async getTopErrors(baseQ: Knex.QueryBuilder): Promise<Array<{ error_message: string; error_code: string | null; count: number }>> {
    const rows = await baseQ.clone()
      .select('error_message', 'error_code')
      .count('* as count')
      .whereNotNull('error_message')
      .where('error_message', '!=', '')
      .groupBy('error_message', 'error_code')
      .orderBy('count', 'desc')
      .limit(15) as Record<string, unknown>[];

    return rows.map((r) => ({
      error_message: String(r.error_message).slice(0, 200),
      error_code: r.error_code ? String(r.error_code) : null,
      count: Number(r.count),
    }));
  }
}
