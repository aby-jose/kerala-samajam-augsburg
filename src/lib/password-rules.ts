/**
 * Password rules, shared between registration, reset and invite acceptance.
 *
 * These live outside `auth-actions.ts` because that file is `"use server"`,
 * and such a file may only export async functions — the same constraint that
 * put `EMAIL_LOG_PAGE_SIZE` in its own module.
 *
 * ---------------------------------------------------------------------------
 * TEMPORARY DUPLICATION — READ BEFORE TOUCHING EITHER COPY
 * ---------------------------------------------------------------------------
 * `auth-actions.ts` has its own private `passwordSchema` and `BCRYPT_ROUNDS`
 * (currently around lines 21-34) that are NOT re-exports of this module. That
 * file had uncommitted, in-flight work from another party at the time this
 * module was written, and `git add auth-actions.ts` stages the whole file —
 * so it could not be touched without sweeping unrelated changes into this
 * commit. The values below were copied out verbatim instead of moved.
 *
 * The two copies must be kept identical by hand until `auth-actions.ts` is
 * free to edit, at which point its private copies should be deleted and
 * replaced with `import { BCRYPT_ROUNDS, passwordSchema } from "./password-rules"`,
 * exactly as this module's sibling, `invite-actions.ts`, already does.
 * ---------------------------------------------------------------------------
 */
import { z } from "zod";

/**
 * Minimum credible password.
 *
 * Neither signup nor reset checked anything at all before — `resetPassword`
 * took `password: any` — so "a" was a valid account password. Length is the
 * one rule that reliably helps; composition rules mostly push people towards
 * `Password1!`, so they are not imposed here.
 */
const PASSWORD_MIN_LENGTH = 12;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200, "Password is too long.");

/**
 * bcrypt work factor. 10 was the default when this was written; 12 is roughly
 * four times the work and is the current sensible floor for a password hash.
 * Existing hashes keep their original cost and are upgraded on next sign-in
 * only if we ever add re-hashing — new and reset passwords get 12 today.
 */
export const BCRYPT_ROUNDS = 12;
