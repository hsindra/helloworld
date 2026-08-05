// Assinatura/verificação do cookie de sessão via Web Crypto (crypto.subtle)
// em vez do módulo `crypto` do Node — precisa rodar tanto em route handlers
// (Node.js runtime) quanto no middleware (Edge runtime), e só a Web Crypto
// API é garantida nos dois. A verificação de senha (scrypt, só roda no
// login) fica em lib/auth.ts, que é Node-only.
export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 dias

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET não configurado.');
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toHex(signature);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSessionToken(username: string): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${username}.${expires}`;
  const signature = await hmac(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [username, expiresStr, signature] = parts;
  const expected = await hmac(`${username}.${expiresStr}`);
  if (!timingSafeEqualStr(signature, expected)) return false;
  if (username !== process.env.AUTH_USERNAME) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  return true;
}
