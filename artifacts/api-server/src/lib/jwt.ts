/**
 * Minimal HMAC-SHA256 JWT helper using Node.js built-in `crypto`.
 * No external dependencies required.
 *
 * Token format: base64url(header).base64url(payload).base64url(signature)
 */
import crypto from "crypto";

const ALG = "sha256";

function b64url(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64url");
}

function sign(data: string, secret: string): string {
  return crypto.createHmac(ALG, secret).update(data).digest("base64url");
}

export interface JwtPayload {
  userId: number;
  githubToken: string;
  iat: number;
  exp: number;
}

/**
 * Create a signed JWT.
 * @param payload   Data to embed (userId, githubToken).
 * @param secret    HMAC secret (SESSION_SECRET).
 * @param ttlSec    Time-to-live in seconds (default 7 days).
 */
export function signJwt(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  ttlSec = 7 * 24 * 60 * 60,
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSec };
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(full));
  const sig = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${sig}`;
}

/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts as [string, string, string];
  const expected = sign(`${header}.${body}`, secret);

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(sig, "base64url"), Buffer.from(expected, "base64url"))) {
    return null;
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString()) as JwtPayload;
  } catch {
    return null;
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) return null;

  return payload;
}
