import type {
  ActivityLogEntry,
  ActivityLogFilter,
  ActivityLogPage,
  ActivityStats,
  LogLevel,
  LogCategory,
} from '../storage/storage-interface.js';

let loggerInstance: ActivityLogger | null = null;

export function getActivityLogger(): ActivityLogger {
  if (!loggerInstance) {
    loggerInstance = new ActivityLogger();
  }
  return loggerInstance;
}

export function setActivityLogger(logger: ActivityLogger): void {
  loggerInstance = logger;
}

interface Delegate {
  enabled(): boolean;
  insert(entry: ActivityLogEntry): Promise<void>;
  query(filter: ActivityLogFilter): Promise<ActivityLogPage>;
  stats(date_from?: string, date_to?: string): Promise<ActivityStats>;
}

export type LogSubscriber = (entry: ActivityLogEntry) => void;

export class ActivityLogger {
  private delegate: Delegate | null = null;
  private enabled = false;
  private defaultSessionId = '';
  private subscribers: LogSubscriber[] = [];

  setDelegate(delegate: Delegate): void {
    this.delegate = delegate;
    this.enabled = delegate.enabled();
  }

  setSessionId(id: string): void {
    this.defaultSessionId = id;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  subscribe(subscriber: LogSubscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== subscriber);
    };
  }

  private async write(entry: ActivityLogEntry): Promise<void> {
    if (this.enabled && this.delegate) {
      try {
        await this.delegate.insert(entry);
      } catch {
        // swallow logging errors so they don't break main flow
      }
    }
    for (const sub of this.subscribers) {
      try {
        sub(entry);
      } catch {
        // swallow subscriber errors
      }
    }
  }

  log(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
    const full: ActivityLogEntry = {
      ...entry,
      session_id: entry.session_id || this.defaultSessionId || undefined,
    };
    this.write(full).catch(() => {});
  }

  logSync(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const full: ActivityLogEntry = {
      ...entry,
      session_id: entry.session_id || this.defaultSessionId || undefined,
    };
    return this.write(full);
  }

  async query(filter: ActivityLogFilter): Promise<ActivityLogPage> {
    if (!this.delegate || !this.enabled) {
      return { rows: [], total: 0, page: filter.page || 1, page_size: filter.page_size || 50, total_pages: 0 };
    }
    return this.delegate.query(filter);
  }

  async stats(date_from?: string, date_to?: string): Promise<ActivityStats> {
    if (!this.delegate || !this.enabled) {
      return {
        total_activities: 0,
        by_category: {},
        by_level: {},
        success_count: 0,
        error_count: 0,
        avg_duration_ms: 0,
        daily_timeline: [],
        top_entities: [],
        error_by_entity: [],
        duration_histogram: [],
        hourly_heatmap: [],
        error_timeline: [],
        by_project: [],
        top_errors: [],
      };
    }
    return this.delegate.stats(date_from, date_to);
  }

  // ─── Convenience methods ──────────────────────────────────────

  toolCall(params: {
    operation: string;
    agent?: string;
    workflow?: string;
    message?: string;
    module?: string;
    project?: string;
    requestBody?: Record<string, unknown>;
    durationMs?: number;
    success: boolean;
    responseSummary?: string;
    responseSize?: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.log({
      level: params.success ? 'info' : 'error',
      category: 'tool_call',
      action: params.operation,
      entity_type: params.agent ? 'agent' : params.workflow ? 'workflow' : undefined,
      entity_name: params.agent || params.workflow,
      module: params.module,
      project: params.project,
      user_message: params.message ? params.message.slice(0, 2000) : undefined,
      request_body: params.requestBody ? JSON.stringify(params.requestBody).slice(0, 10000) : undefined,
      response_summary: params.responseSummary ? params.responseSummary.slice(0, 500) : undefined,
      response_size: params.responseSize,
      duration_ms: params.durationMs,
      success: params.success,
      error_code: params.errorCode,
      error_message: params.errorMessage ? params.errorMessage.slice(0, 2000) : undefined,
      metadata: params.metadata,
    });
  }

  systemEvent(params: {
    level: LogLevel;
    action: string;
    message?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.log({
      level: params.level,
      category: 'system',
      action: params.action,
      response_summary: params.message ? params.message.slice(0, 500) : undefined,
      metadata: params.metadata,
      success: params.level !== 'error',
    });
  }

  validationError(params: {
    operation: string;
    errorMessage: string;
    requestBody?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): void {
    this.log({
      level: 'warn',
      category: 'validation_error',
      action: params.operation,
      error_message: params.errorMessage.slice(0, 2000),
      request_body: params.requestBody ? JSON.stringify(params.requestBody).slice(0, 5000) : undefined,
      success: false,
      metadata: params.metadata,
    });
  }

  dbOperation(params: {
    action: string;
    project?: string;
    durationMs?: number;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): void {
    this.log({
      level: params.success ? 'debug' : 'error',
      category: 'db_operation',
      action: `db.${params.action}`,
      project: params.project,
      duration_ms: params.durationMs,
      success: params.success,
      error_message: params.errorMessage ? params.errorMessage.slice(0, 2000) : undefined,
      metadata: params.metadata,
    });
  }
}
