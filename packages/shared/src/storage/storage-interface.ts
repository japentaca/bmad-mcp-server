export interface StoredDocument {
  projectName: string;
  path: string;
  content: string;
  contentType: string;
  workflow?: string;
  agent?: string;
  version: number;
  updatedAt: string;
}

export interface WorkflowStatus {
  projectName: string;
  workflow: string;
  status: Record<string, unknown>;
  updatedAt: string;
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
  contentType: string;
  updatedAt: string;
}

export interface SearchQuery {
  projectName: string;
  query: string;
  language?: string;
  contentType?: string;
  workflow?: string;
  limit?: number;
  offset?: number;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs: number;
  driver: string;
  pool?: {
    active: number;
    idle: number;
    waiting: number;
  };
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'mcp_request' | 'tool_call' | 'agent_execution' | 'workflow_execution' | 'resource_read' | 'db_operation' | 'system' | 'validation_error';

export interface ActivityLogEntry {
  id?: number;
  timestamp?: string;
  level: LogLevel;
  category: LogCategory;
  action: string;
  entity_type?: string;
  entity_name?: string;
  project?: string;
  module?: string;
  user_message?: string;
  request_body?: string;
  response_summary?: string;
  response_size?: number;
  duration_ms?: number;
  success: boolean;
  error_code?: string;
  error_message?: string;
  session_id?: string;
  client_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogFilter {
  level?: LogLevel | LogLevel[];
  category?: LogCategory | LogCategory[];
  action?: string;
  entity_type?: string;
  entity_name?: string;
  project?: string;
  module?: string;
  success?: boolean;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface ActivityLogPage {
  rows: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ActivityStats {
  total_activities: number;
  by_category: Record<string, number>;
  by_level: Record<string, number>;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  daily_timeline: Array<{ date: string; count: number }>;
  top_entities: Array<{ entity_name: string; entity_type: string; count: number }>;
  error_by_entity: Array<{ entity_name: string; entity_type: string; error_count: number; total_count: number; error_rate: number }>;
  duration_histogram: Array<{ bucket: string; min_ms: number; max_ms: number | null; count: number }>;
  hourly_heatmap: Array<{ day: number; hour: number; count: number }>;
  error_timeline: Array<{ date: string; error_count: number }>;
  by_project: Array<{ project: string; count: number; error_count: number }>;
  top_errors: Array<{ error_message: string; error_code: string | null; count: number }>;
}

export interface BMADStorage {
  ensureProject(projectName: string, config?: Record<string, unknown>): Promise<void>;
  saveDocument(doc: Omit<StoredDocument, 'version' | 'updatedAt'>): Promise<StoredDocument>;
  readDocument(projectName: string, path: string): Promise<StoredDocument | null>;
  listDocuments(
    projectName: string,
    filter?: { contentType?: string; workflow?: string; limit?: number; offset?: number },
  ): Promise<StoredDocument[]>;
  searchDocuments(query: SearchQuery): Promise<SearchResult[]>;
  saveWorkflowStatus(status: WorkflowStatus): Promise<WorkflowStatus>;
  readWorkflowStatus(projectName: string, workflow: string): Promise<WorkflowStatus | null>;
  listWorkflowStatuses(projectName: string): Promise<WorkflowStatus[]>;
  healthCheck(): Promise<HealthStatus>;
  initialize(): Promise<void>;
  insertActivityLog(entry: ActivityLogEntry): Promise<void>;
  queryActivityLogs(filter: ActivityLogFilter): Promise<ActivityLogPage>;
  getActivityStats(date_from?: string, date_to?: string): Promise<ActivityStats>;
}
