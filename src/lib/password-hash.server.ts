/**
 * Salted, slow password hashing for admin/staff credentials.
 *
 * New hashes use scrypt: `scrypt$<N>$<r>$<p>$<saltHex>$<keyHex>`.
 * Legacy unsalted SHA-256 hex hashes are still verified so existing admin and
 * staff logins keep working; callers rehash to scrypt on the next successful
 * login (see `needsRehash`).
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(pw: string, salt: Buffer, keylen: number, params: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(pw, salt, keylen, { N: params.N, r: params.r, p: params.p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key as Buffer),
    );
  });
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

function equalHex(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function verifyPassword(
  pw: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, saltHex, keyHex] = stored.split("$");
    try {
      const key = await scrypt(pw, Buffer.from(saltHex, "hex"), Buffer.from(keyHex, "hex").length, {
        N: Number(n),
        r: Number(r),
        p: Number(p),
      });
      return { ok: equalHex(key, Buffer.from(keyHex, "hex")), needsRehash: false };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }

  // Legacy unsalted SHA-256 hex
  const legacy = createHash("sha256").update(pw, "utf8").digest("hex");
  const ok = legacy.length === stored.length && timingSafeEqual(Buffer.from(legacy), Buffer.from(stored));
  return { ok, needsRehash: ok };
}
