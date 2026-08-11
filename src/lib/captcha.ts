import { randomInt } from "crypto";
import { nanoid } from "nanoid";

import { prisma } from "./prisma";

/**
 * Challenge/response codes for the sign-in, sign-up, contact and event
 * registration forms.
 *
 * Held in the database, not in a module-level Map. The Map only worked when
 * the process that issued a challenge also received the answer — behind more
 * than one instance, or on any serverless platform, verification usually
 * landed on a different worker and rejected a correct code. Codes also come
 * from `crypto.randomInt` rather than `Math.random`, which is predictable
 * enough to derive future challenges from observed ones.
 */

/** Visually unambiguous — no O/0, I/1 confusion for the person typing it. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const TTL_MS = 5 * 60 * 1000;

export async function generateCaptcha() {
  const id = nanoid();
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET.charAt(randomInt(ALPHABET.length));
  }

  await prisma.captcha.create({
    data: { token: id, code, expires: new Date(Date.now() + TTL_MS) },
  });

  // Opportunistic cleanup — cheap, and keeps the collection from growing
  // without bound without needing a scheduled job.
  if (Math.random() < 0.02) {
    await prisma.captcha
      .deleteMany({ where: { expires: { lt: new Date() } } })
      .catch(() => {});
  }

  return { id, code };
}

export async function verifyCaptcha(id: string, code: string): Promise<boolean> {
  if (!id || !code) return false;

  const stored = await prisma.captcha.findUnique({ where: { token: id } });
  if (!stored) return false;

  // Single use: consumed whether or not the answer was right, so a challenge
  // cannot be guessed at repeatedly.
  await prisma.captcha.delete({ where: { id: stored.id } }).catch(() => {});

  if (stored.expires < new Date()) return false;

  return stored.code.trim().toUpperCase() === code.trim().toUpperCase();
}
