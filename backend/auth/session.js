const ACCESS_COOKIE = 'ica_access';
const REFRESH_COOKIE = 'ica_refresh';

export function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf('=');
      if (separator < 0) return cookies;
      const key = decodeURIComponent(item.slice(0, separator));
      const value = decodeURIComponent(item.slice(separator + 1));
      cookies[key] = value;
      return cookies;
    }, {});
}

export function serializeCookie(name, value, {
  maxAge = null,
  secure = false,
  httpOnly = true,
  sameSite = 'Lax',
  path = '/'
} = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

export function createSessionManager({ gateway, authMode, production }) {
  const authEnabled = authMode !== 'disabled' && gateway.configured;

  function setSessionCookies(res, session) {
    const accessMaxAge = Math.max(60, Number(session.expires_in || 3600));
    const refreshMaxAge = 60 * 60 * 24 * 30;
    res.append('Set-Cookie', serializeCookie(ACCESS_COOKIE, session.access_token, {
      maxAge: accessMaxAge,
      secure: production
    }));
    res.append('Set-Cookie', serializeCookie(REFRESH_COOKIE, session.refresh_token, {
      maxAge: refreshMaxAge,
      secure: production
    }));
  }

  function clearSessionCookies(res) {
    res.append('Set-Cookie', serializeCookie(ACCESS_COOKIE, '', { maxAge: 0, secure: production }));
    res.append('Set-Cookie', serializeCookie(REFRESH_COOKIE, '', { maxAge: 0, secure: production }));
  }

  async function resolveUser(req, res) {
    if (!authEnabled) {
      return {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'founder-preview@local.ica',
        user_metadata: { display_name: 'Founder Preview' },
        localPreview: true
      };
    }

    const cookies = parseCookies(req.headers.cookie);
    let accessToken = cookies[ACCESS_COOKIE];

    if (accessToken) {
      try {
        return await gateway.getUser(accessToken);
      } catch (error) {
        if (error.status !== 401) throw error;
      }
    }

    const refreshToken = cookies[REFRESH_COOKIE];
    if (!refreshToken) return null;

    try {
      const session = await gateway.refreshSession(refreshToken);
      setSessionCookies(res, session);
      accessToken = session.access_token;
      return await gateway.getUser(accessToken);
    } catch {
      clearSessionCookies(res);
      return null;
    }
  }

  async function requireUser(req, res, next) {
    try {
      const user = await resolveUser(req, res);
      if (!user) {
        return res.status(401).json({
          error: 'Please sign in to continue.',
          code: 'AUTH_REQUIRED'
        });
      }
      req.auth = { user };
      next();
    } catch (error) {
      next(error);
    }
  }

  return {
    authEnabled,
    resolveUser,
    requireUser,
    setSessionCookies,
    clearSessionCookies
  };
}
