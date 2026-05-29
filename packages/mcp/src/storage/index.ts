import type { BMADStorage, HealthStatus, ActivityLogEntry, ActivityLogFilter } from './storage-interface.js';
import { KnexStorage } from './knex-storage.js';
import { getActivityLogger } from '../utils/activity-logger-adapter.js';

let cachedStorage: BMADStorage | null = null;
let dbStatus: { connected: boolean; driver: string; error?: string; health?: HealthStatus } = {
  connected: false,
  driver: 'none',
};

export function getDbStatus(): typeof dbStatus {
  return { ...dbStatus };
}

function createStorage(dbUrl: string): BMADStorage {
  if (cachedStorage) return cachedStorage;
  cachedStorage = new KnexStorage(dbUrl);
  return cachedStorage;
}

export function getStorage(): BMADStorage {
  if (!cachedStorage) {
    if (process.env.BMAD_DB_URL || process.env.BMAD_SQLITE_PATH) {
      throw new Error(
        'Storage not initialized. DB was configured but initialization did not complete successfully.',
      );
    }
    throw new Error(
      'BMAD_DB_URL or BMAD_SQLITE_PATH is not configured. Set the environment variable to enable database persistence (e.g., postgresql://user:pass@host/db, sqlite://path/to/db.sqlite, or BMAD_SQLITE_PATH=/path/to/bmad.db).',
    );
  }
  return cachedStorage;
}

export function getStorageDriver(): string {
  if (!cachedStorage) return dbStatus.driver;
  if (cachedStorage instanceof KnexStorage) return cachedStorage.getDriver();
  return 'unknown';
}

export async function initializeStorage(): Promise<void> {
  let dbUrl = process.env.BMAD_DB_URL;

  if (!dbUrl && process.env.BMAD_SQLITE_PATH) {
    dbUrl = `sqlite://${process.env.BMAD_SQLITE_PATH}`;
    console.error(`[storage] Using SQLite from BMAD_SQLITE_PATH: ${process.env.BMAD_SQLITE_PATH}`);
  }

  if (!dbUrl) {
    dbStatus = { connected: false, driver: 'none' };
    console.error('[storage] No BMAD_DB_URL or BMAD_SQLITE_PATH set. DB persistence is disabled.');
    return;
  }

  const storage = createStorage(dbUrl);
  await storage.initialize();
  const health = await storage.healthCheck();

  if (!health.healthy) {
    const driver = dbUrl.startsWith('postgres') ? 'postgresql' : 'sqlite';
    dbStatus = {
      connected: false,
      driver,
      error: 'Health check failed',
      health,
    };
    throw new Error(
      `Database health check failed for ${driver}. Verify the connection string and that the database is reachable.`,
    );
  }

  dbStatus = { connected: true, driver: getStorageDriver(), health };
  console.error(`[storage] Connected to ${dbStatus.driver} database (latency: ${health.latencyMs}ms)`);

  // Initialize activity logger delegate
  setupLoggingDelegate();
}

function setupLoggingDelegate(): void {
  const storage = cachedStorage;
  if (!storage) return;
  try {
    const logger = getActivityLogger();
    logger.setDelegate({
      enabled: () => !!storage && dbStatus.connected,
      insert: (entry: ActivityLogEntry) => storage.insertActivityLog(entry),
      query: (filter: ActivityLogFilter) => storage.queryActivityLogs(filter),
      stats: (date_from?: string, date_to?: string) => storage.getActivityStats(date_from, date_to),
    });
  } catch {
    // Activity logger is optional; MCP server works without it
  }
}

export * from './storage-interface.js';
export { KnexStorage } from './knex-storage.js';
