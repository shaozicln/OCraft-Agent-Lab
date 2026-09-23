import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const KEY_SALT = 'ocraft-llm-key-v1';

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(`${KEY_SALT}:${secret}`).digest();
}

/** AES-256-GCM：iv.ciphertext.tag（均为 base64url） */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64url'),
    enc.toString('base64url'),
    tag.toString('base64url'),
  ].join('.');
}

export function decryptSecret(payload: string, secret: string): string | null {
  const parts = payload.split('.');
  if (parts.length !== 3) return null;
  const [ivB64, encB64, tagB64] = parts;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFromSecret(secret),
      Buffer.from(ivB64, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64url')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (!t) return '';
  if (t.length <= 8) return '••••';
  return `${t.slice(0, 3)}••••${t.slice(-4)}`;
}
