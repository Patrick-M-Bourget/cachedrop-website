// The tokens emailed links carry (download, unsubscribe): 32 random bytes as base64url, stored
// only as their SHA-256 hash, so a database leak gives no working links.
import { createHash, randomBytes } from 'node:crypto';

export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// The per-download code api/download appends to the signed URL as &ref= (Decision 39): 16 random
// bytes as base64url. It is not a token or a hash of one and grants nothing; it only maps to a signup.
export const REF = /^[A-Za-z0-9_-]{22}$/;
export const newRef = () => randomBytes(16).toString('base64url');
