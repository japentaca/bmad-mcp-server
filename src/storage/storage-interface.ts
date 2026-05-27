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

export interface BMADStorage {
  /** Ensure the project exists in the DB */
  ensureProject(projectName: string, config?: Record<string, unknown>): Promise<void>;

  /** Save/update a document */
  saveDocument(doc: Omit<StoredDocument, 'version' | 'updatedAt'>): Promise<StoredDocument>;

  /** Read a document by path */
  readDocument(projectName: string, path: string): Promise<StoredDocument | null>;

  /** List documents for a project */
  listDocuments(
    projectName: string,
    filter?: { contentType?: string; workflow?: string; limit?: number; offset?: number },
  ): Promise<StoredDocument[]>;

  /** Full-text search across documents */
  searchDocuments(query: SearchQuery): Promise<SearchResult[]>;

  /** Save workflow status */
  saveWorkflowStatus(status: WorkflowStatus): Promise<WorkflowStatus>;

  /** Read workflow status */
  readWorkflowStatus(projectName: string, workflow: string): Promise<WorkflowStatus | null>;

  /** List all workflow statuses for a project */
  listWorkflowStatuses(projectName: string): Promise<WorkflowStatus[]>;

  /** Check connection health with latency and pool info */
  healthCheck(): Promise<HealthStatus>;

  /** Initialize (create DB, tables, indexes) */
  initialize(): Promise<void>;
}
