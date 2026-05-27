import type { BMADStorage, HealthStatus } from './storage-interface.js';
import { KnexStorage } from './knex-storage.js';

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
    if (!process.env.BMAD_DB_URL) {
      throw new Error(
        'BMAD_DB_URL is not configured. Set the environment variable to enable database persistence (e.g., postgresql://user:pass@host/db or sqlite://path/to/db.sqlite).',
      );
    }
    throw new Error(
      'Storage not initialized. DB was configured but initialization did not complete successfully.',
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
  const dbUrl = process.env.BMAD_DB_URL;

  if (!dbUrl) {
    dbStatus = { connected: false, driver: 'none' };
    console.error('[storage] No BMAD_DB_URL set. DB persistence is disabled.');
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
}

export * from './storage-interface.js';
export { KnexStorage } from './knex-storage.js';
