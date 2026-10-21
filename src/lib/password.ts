import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/* ---------- Passwords (scrypt, built into Node) ---------- */

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, PARAMS);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, PARAMS);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A readable one-time password for new or reset accounts, e.g. "maple-river-4821". */
export function temporaryPassword(): string {
  const words = [
    "amber",
    "birch",
    "cedar",
    "delta",
    "ember",
    "fjord",
    "grove",
    "harbor",
    "iris",
    "juniper",
    "kestrel",
    "lumen",
    "maple",
    "north",
    "orbit",
    "pine",
    "quartz",
    "river",
    "sierra",
    "tide",
    "umber",
    "vista",
    "willow",
    "zephyr",
  ];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE() % 9000)}`;
}
