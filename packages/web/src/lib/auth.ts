import { v4 as uuid } from 'uuid';

interface Session {
  id: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();

const SESSION_COOKIE = 'bmad_session';
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export function createSession(): string {
  const id = uuid();
  sessions.set(id, { id, createdAt: Date.now() });
  return id;
}

export function validateSession(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() - session.createdAt > MAX_SESSION_AGE_MS) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function verifyAccessToken(token: string): boolean {
  const expected = process.env.BMAD_ACCESS_TOKEN;
  if (!expected) return true;
  return token === expected;
}
