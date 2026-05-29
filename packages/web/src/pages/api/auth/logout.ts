import type { APIRoute } from 'astro';
import { getSessionCookieName, destroySession } from '@lib/auth';

export const POST: APIRoute = ({ cookies, redirect }) => {
  const sessionId = cookies.get(getSessionCookieName())?.value;
  if (sessionId) {
    destroySession(sessionId);
  }
  cookies.delete(getSessionCookieName(), { path: '/' });
  return redirect('/login');
};

export const GET: APIRoute = ({ cookies, redirect }) => {
  const sessionId = cookies.get(getSessionCookieName())?.value;
  if (sessionId) {
    destroySession(sessionId);
  }
  cookies.delete(getSessionCookieName(), { path: '/' });
  return redirect('/login');
};
