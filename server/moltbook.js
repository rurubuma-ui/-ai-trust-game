/**
 * Moltbook Identity verification for AI agents.
 * @see https://moltbook.com/developers.md
 */

const MOLTBOOK_VERIFY_URL = 'https://www.moltbook.com/api/v1/agents/verify-identity';

/**
 * Verify Moltbook identity token.
 * @param {string} token - Identity token from X-Moltbook-Identity header
 * @param {string} [audience] - Optional audience (your domain) for token restriction
 * @returns {Promise<{valid: boolean, agent?: object, error?: string}>}
 */
export async function verifyMoltbookIdentity(token, audience) {
  const appKey = process.env.MOLTBOOK_APP_KEY;
  if (!appKey) {
    console.error('[moltbook] MOLTBOOK_APP_KEY not set');
    return { valid: false, error: 'moltbook_not_configured' };
  }

  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'missing_token' };
  }

  try {
    const body = { token: token.trim() };
    if (audience) body.audience = audience;

    const res = await fetch(MOLTBOOK_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Moltbook-App-Key': appKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.warn('[moltbook] Verify failed:', data?.error || res.status);
      return { valid: false, error: data?.error || 'verification_failed' };
    }

    if (!data.valid || !data.agent) {
      return { valid: false, error: data?.error || 'invalid_token' };
    }

    return { valid: true, agent: data.agent };
  } catch (err) {
    console.error('[moltbook] Verify error:', err);
    return { valid: false, error: 'verification_error' };
  }
}

/**
 * Express middleware: require Moltbook agent identity.
 * On success: req.moltbookAgent = agent
 * On failure: responds with 401
 */
export function requireMoltbookAgent(req, res, next) {
  const token = req.headers['x-moltbook-identity'];
  const audience = process.env.MOLTBOOK_AUDIENCE || null;

  if (!token) {
    return res.status(401).json({
      error: 'moltbook_identity_required',
      hint: 'Include X-Moltbook-Identity header with your identity token. See https://moltbook.com/auth.md',
    });
  }

  verifyMoltbookIdentity(token, audience).then((result) => {
    if (!result.valid) {
      return res.status(401).json({
        error: result.error || 'invalid_identity',
        hint: 'Get a fresh token from POST /api/v1/agents/me/identity-token',
      });
    }
    req.moltbookAgent = result.agent;
    next();
  }).catch((err) => {
    console.error('[moltbook] Middleware error:', err);
    res.status(500).json({ error: 'verification_error' });
  });
}
