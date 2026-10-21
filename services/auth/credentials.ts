import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function scryptKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptKey(password, salt);
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, , , , saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, "base64url");
  const actual = await scryptKey(password, Buffer.from(saltValue, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validatePassword(password: string) {
  if (password.length < 10 || password.length > 128)
    return "Use uma senha entre 10 e 128 caracteres.";
  if (!/[a-z]/i.test(password) || !/\d/.test(password))
    return "Inclua ao menos uma letra e um número.";
  return null;
}
