import { KnexStorage } from '@bmad/shared';

let storage: KnexStorage | null = null;

export function getDb(): KnexStorage {
  if (!storage) {
    const dbUrl = process.env.BMAD_DB_URL || 'sqlite://./bmad.db';
    storage = new KnexStorage(dbUrl);
  }
  return storage;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  await db.initialize();
}

export function getStorage(): KnexStorage {
  return getDb();
}
