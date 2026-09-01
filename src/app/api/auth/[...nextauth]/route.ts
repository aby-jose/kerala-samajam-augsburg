import NextAuth from "next-auth";
import { publicAuthOptions } from "@/lib/auth";

/**
 * Never prerendered, and never probed for static paths.
 *
 * Every handler here reads cookies and headers and writes a session cookie
 * back, so there is nothing static about it. Without this, Next tries to
 * generate static paths for the catch-all segment in dev, which spawns a
 * worker that loads the whole auth module graph — and when that worker dies
 * the pool stays wedged, so every route compiled afterwards answers with the
 * HTML error page. next-auth's client then reports it as the opaque
 * `CLIENT_FETCH_ERROR: Unexpected token '<'`.
 */
export const dynamic = "force-dynamic";

const handler = NextAuth(publicAuthOptions);
export { handler as GET, handler as POST };
