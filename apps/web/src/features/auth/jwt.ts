import type { AuthUser } from './types';

/**
 * atob() yields a binary string, one char per byte. JWT payloads are UTF-8,
 * so any non-ASCII character in a claim (every Turkish name with ç/ğ/ı/ö/ş/ü)
 * came back as mojibake — "şeyma" rendered as "Åeyma" in the header. Decoding
 * the bytes as real UTF-8 fixes it.
 */
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Decodes the JWT payload for display purposes only (username/role in the
 * UI). This never substitutes for real verification — every request is
 * independently authenticated and authorized by the API.
 */
export function decodeAccessToken(token: string): AuthUser | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const claims: unknown = JSON.parse(decodeBase64Url(payload));
    if (
      typeof claims !== 'object' ||
      claims === null ||
      typeof (claims as AuthUser).username !== 'string' ||
      typeof (claims as AuthUser).role !== 'string'
    ) {
      return null;
    }
    return claims as AuthUser;
  } catch {
    return null;
  }
}
