import { decode, encode } from "next-auth/jwt";
import type { JWTDecodeParams, JWTEncodeParams } from "next-auth/jwt";

/**
 * Cookie names and JWT key derivation for the two session namespaces.
 *
 * Deliberately free of Prisma, bcrypt and the provider list so that
 * `middleware.ts` can import it — middleware runs on the Edge runtime, where
 * pulling in `auth.ts` would fail at build time.
 *
 * The separation problem
 * ----------------------
 * The admin and public sessions used to differ only by cookie name. next-auth
 * v4 derives the JWE key with `hkdf(sha256, secret, salt, …)` and its core
 * never passes a salt, so both namespaces resolved to the *same* key: a member
 * could replay their public session token under the admin cookie name and be
 * handed a valid admin session.
 *
 * Passing a distinct salt per namespace fixes that at the cryptographic level.
 * A token minted for one side no longer decrypts on the other, whatever it is
 * called. `ADMIN_NEXTAUTH_SECRET` is honoured on top of that when set, so the
 * two can also be rotated independently — but security no longer depends on
 * anyone remembering to set it.
 */

export const PUBLIC_SESSION_COOKIE = "ksa-public.session-token";
export const ADMIN_SESSION_COOKIE = "ksa-admin.session-token";

/** Domain separation for the HKDF step. Changing a value logs that side out. */
const PUBLIC_JWT_SALT = "ksa.public.session";
const ADMIN_JWT_SALT = "ksa.admin.session";

export const PUBLIC_JWT_SECRET = process.env.NEXTAUTH_SECRET ?? "";

/**
 * Falls back to the shared secret so a missing variable cannot take the admin
 * panel offline. The salt already separates the namespaces; a dedicated secret
 * adds independent rotation on top.
 */
export const ADMIN_JWT_SECRET =
  process.env.ADMIN_NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

function saltedJwt(salt: string) {
  return {
    encode: (params: JWTEncodeParams) => encode({ ...params, salt }),
    decode: (params: JWTDecodeParams) => decode({ ...params, salt }),
  };
}

export const publicJwt = saltedJwt(PUBLIC_JWT_SALT);
export const adminJwt = saltedJwt(ADMIN_JWT_SALT);

/** Shape of what the callbacks put in the token, for consumers like middleware. */
export interface AppToken {
  id?: string;
  role?: string;
  email?: string | null;
}
