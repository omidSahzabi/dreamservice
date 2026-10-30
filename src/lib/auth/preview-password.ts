import "server-only";
import {scrypt, timingSafeEqual} from "node:crypto";

// Fixed costs prevent a configuration value from selecting unbounded work.
export function verifyPreviewPassword(password: string, hash: string): Promise<boolean> {
  const [, salt, expected] = hash.split("$");
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 32, {N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024}, (error, key) => {
      if (error) return reject(error);
      resolve(timingSafeEqual(key, Buffer.from(expected, "hex")));
    });
  });
}
