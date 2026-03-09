/**
 * Telegram authentication: Web App initData and Login Widget.
 * @see https://core.telegram.org/widgets/login
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from 'crypto';

const AUTH_MAX_AGE_SEC = 86400; // 24 hours - reject older auth

/**
 * Verify Telegram Web App initData.
 * Used when user opens app from Telegram bot (Web App).
 */
export function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date'), 10);
    if (Date.now() / 1000 - authDate > AUTH_MAX_AGE_SEC) return null;

    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Verify Telegram Login Widget hash.
 * Used when user clicks "Login with Telegram" on website.
 */
export function verifyLoginWidget(data, botToken) {
  if (!data || !data.hash || !botToken) return null;
  try {
    const { hash, auth_date, ...rest } = data;
    const authDate = parseInt(auth_date, 10);
    if (Date.now() / 1000 - authDate > AUTH_MAX_AGE_SEC) return null;

    const dataCheckString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${rest[k]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    return {
      id: rest.id,
      first_name: rest.first_name,
      last_name: rest.last_name,
      username: rest.username,
      photo_url: rest.photo_url,
    };
  } catch {
    return null;
  }
}
