import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => (error === null ? resolve(key) : reject(error)));
  });
}

export async function hashPassword(password: string) {
  const passwordSalt = randomBytes(16).toString("hex");
  const key = await derive(password, passwordSalt);
  return { passwordHash: key.toString("hex"), passwordSalt };
}

export async function verifyPassword(password: string, stored: { readonly passwordHash: string; readonly passwordSalt: string }) {
  const key = await derive(password, stored.passwordSalt);
  const expected = Buffer.from(stored.passwordHash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function createToken(): string {
  return randomBytes(32).toString("base64url");
}
