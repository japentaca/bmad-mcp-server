import { defineMiddleware } from 'astro:middleware';
import { getSessionCookieName, validateSession } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  const { url, cookies } = context;

  if (url.pathname === '/login' || url.pathname.startsWith('/api/auth/')) {
    return next();
  }

  const sessionId = cookies.get(getSessionCookieName())?.value;
  const valid = validateSession(sessionId);

  context.locals.session = { valid, id: sessionId };

  if (!valid) {
    return context.redirect('/login');
  }

  return next();
});
