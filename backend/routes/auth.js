import express from 'express';

export function createAuthRouter({ gateway, sessionManager, usageService }) {
  const router = express.Router();
  const attempts = new Map();

  router.post('/auth/login', async (req, res, next) => {
    try {
      if (!sessionManager.authEnabled) {
        return res.status(400).json({ error: 'Authentication is disabled in this environment.' });
      }

      const clientKey = String(req.ip || 'unknown');
      enforceLoginLimit(attempts, clientKey);

      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Enter your email address and password.' });
      }

      const session = await gateway.signInWithPassword({ email, password });
      sessionManager.setSessionCookies(res, session);
      const user = session.user || await gateway.getUser(session.access_token);
      const member = await usageService.getSummary(user);
      attempts.delete(clientKey);

      return res.json({ ok: true, user: publicUser(user), member });
    } catch (error) {
      if (error.status === 400 || error.status === 401) {
        return res.status(401).json({ error: 'The email address or password is incorrect.' });
      }
      next(error);
    }
  });

  router.get('/auth/session', async (req, res, next) => {
    try {
      const user = await sessionManager.resolveUser(req, res);
      if (!user) return res.json({ authenticated: false });
      const member = await usageService.getSummary(user);
      return res.json({ authenticated: true, user: publicUser(user), member });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/logout', (_req, res) => {
    sessionManager.clearSessionCookies(res);
    res.json({ ok: true });
  });

  return router;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email || '',
    displayName: user.user_metadata?.display_name || user.user_metadata?.name || ''
  };
}

function enforceLoginLimit(attempts, key) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const history = (attempts.get(key) || []).filter(time => now - time < windowMs);
  if (history.length >= 10) {
    const error = new Error('Too many sign-in attempts. Please wait a few minutes.');
    error.status = 429;
    error.code = 'LOGIN_RATE_LIMIT';
    throw error;
  }
  history.push(now);
  attempts.set(key, history);
}
