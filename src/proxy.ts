import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { ADMIN_JWT_SECRET, ADMIN_SESSION_COOKIE, adminJwt } from "@/lib/auth-tokens";

/**
 * Gate every `/admin` page before it renders.
 *
 * The dashboard used to be protected only by a `useEffect` redirect in its
 * client layout. That runs after the server has already rendered the page and
 * streamed its payload, so any admin page reading from the database handed its
 * rows to the browser and *then* redirected — the data was gone by the time
 * the guard fired.
 *
 * This is the outer perimeter, not the whole defence: it checks the signed
 * role in the token, which can be up to `ROLE_REFRESH_INTERVAL_MS` stale, and
 * middleware runs on the Edge runtime where the database is out of reach. The
 * `requirePermission()` / `requirePermissionPage()` calls inside each action
 * and page stay authoritative.
 */

/** Reachable without a session — otherwise signing in would be impossible. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/invite"];

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: ADMIN_JWT_SECRET,
    cookieName: ADMIN_SESSION_COOKIE,
    decode: adminJwt.decode,
  });

  if (token?.role === "ADMIN") {
    return NextResponse.next();
  }

  const login = new URL("/admin/login", req.url);
  // Send them back where they were aiming once they have signed in.
  if (pathname !== "/admin") login.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // `/api/admin/auth/*` is deliberately outside this matcher: next-auth has to
  // be able to serve its own sign-in, callback and CSRF routes unauthenticated.
  matcher: ["/admin/:path*"],
};
