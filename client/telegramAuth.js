/**
 * Telegram auth for Real or AI game.
 * - Browser: Login Widget (redirect flow)
 * - Telegram Web App: initData (auto-login)
 */

const AUTH_STORAGE_KEY = 'realorai_telegram_token';
const AUTH_USER_KEY = 'realorai_telegram_user';

export function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuth(token, user) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, token);
    if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('[auth] Storage failed:', e);
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {}
}

export function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Check URL for auth_token (from Login Widget redirect), store and clear.
 */
export function handleAuthRedirect(apiBase) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token');
  if (token) {
    storeAuth(token, null);
    params.delete('auth_token');
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return true;
  }
  return false;
}

/**
 * Login via Telegram Web App initData.
 */
export async function loginWithInitData(apiBase) {
  const webApp = window.Telegram?.WebApp;
  const initData = webApp?.initData;
  if (!initData) return null;
  const startParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tg_start') : null;

  const res = await fetch(`${apiBase}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, startParam }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  storeAuth(data.token, data.user);
  return data.user;
}

/**
 * Init Login Widget for browser users.
 */
export function initLoginWidget(apiBase, botUsername, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !botUsername) return;

  const callbackUrl = `${apiBase}/auth/telegram/callback`;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login', botUsername);
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-auth-url', callbackUrl);
  script.setAttribute('data-request-access', 'write');
  container.appendChild(script);
}

/**
 * Fetch auth config and init.
 */
export async function initTelegramAuth(apiBase) {
  const configRes = await fetch(`${apiBase}/auth/telegram/config`);
  if (!configRes.ok) return { enabled: false };

  const config = await configRes.json();
  if (!config.enabled) return { enabled: false };

  // Handle redirect from Login Widget
  if (handleAuthRedirect(apiBase)) {
    const meRes = await fetch(`${apiBase}/auth/me`, { headers: getAuthHeaders() });
    if (meRes.ok) {
      const { user } = await meRes.json();
      storeAuth(getStoredToken(), user);
      return { enabled: true, user, justLoggedIn: true };
    }
  }

  // Already logged in?
  const token = getStoredToken();
  if (token) {
    const meRes = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (meRes.ok) {
      const { user } = await meRes.json();
      storeAuth(token, user);
      return { enabled: true, user };
    }
    clearAuth();
  }

  // Telegram Web App: auto-login with initData
  if (window.Telegram?.WebApp?.initData) {
    const user = await loginWithInitData(apiBase);
    if (user) return { enabled: true, user, fromWebApp: true };
  }

  // Init Login Widget for browser
  if (config.botUsername) {
    initLoginWidget(apiBase, config.botUsername, 'telegram-login-widget');
  }

  return { enabled: true, user: null };
}
