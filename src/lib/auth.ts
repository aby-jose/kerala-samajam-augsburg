import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { verifyCaptcha } from "./captcha";
import { clearPersistentRateLimit, persistentRateLimit } from "./rate-limit";

/**
 * A real bcrypt hash of a value nobody can supply, compared against when no
 * account matches. Without it, a missing account returns instantly while a
 * wrong password takes ~100ms, and that gap alone enumerates the member list.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9Z4Vp4H0m1zGVhLPUKmjNUAAiOGvKzO";
import {
  ADMIN_JWT_SECRET,
  ADMIN_SESSION_COOKIE,
  PUBLIC_JWT_SECRET,
  PUBLIC_SESSION_COOKIE,
  adminJwt,
  publicJwt,
} from "./auth-tokens";

/**
 * How often a live session re-checks its role against the database.
 *
 * The role is signed into the token at sign-in, so without this a suspension
 * or a demotion changes nothing until the token expires — up to 30 days of an
 * ex-administrator still holding administrator access. Re-reading on every
 * request would put a query in front of every `getServerSession` call, so the
 * token carries the time of its last check and refreshes on this interval.
 */
const ROLE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Sign-in attempts allowed per account per window.
 *
 * Counted in the database, because an in-memory counter resets on every cold
 * start and is per-worker — neither of which slows down an attacker. Keyed by
 * the address being *attempted*, so one target cannot be ground down, and
 * cleared on success so a legitimate user who mistypes twice is unaffected.
 */
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Every credential failure returns this same message.
 *
 * The old branches — "User not found", "Invalid password", "Unauthorized.
 * Admin access required." — let anyone test whether an address had an account
 * and, worse, which accounts were administrators. Suspension stays distinct
 * because the person needs to know to contact the committee, and it is only
 * reachable after the correct password.
 */
const GENERIC_CREDENTIALS_ERROR = "Invalid email or password.";

/**
 * Shared credential check for both portals.
 *
 * `requireAdmin` decides whether this is the admin portal, where a non-admin
 * must not be able to tell a wrong password from a wrong door.
 */
async function authorizeCredentials(
  email: string,
  password: string,
  { adminOnly }: { adminOnly: boolean }
) {
  const normalisedEmail = email.trim().toLowerCase();
  const attemptKey = `login:${adminOnly ? "admin" : "public"}:${normalisedEmail}`;

  const { ok } = await persistentRateLimit(
    attemptKey,
    LOGIN_ATTEMPT_LIMIT,
    LOGIN_ATTEMPT_WINDOW_MS
  );
  if (!ok) {
    throw new Error("Too many sign-in attempts. Please try again in 15 minutes.");
  }

  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  // Compare against a dummy hash when the account does not exist, so the
  // response takes the same time either way and cannot be used to enumerate.
  const hash = user?.password ?? DUMMY_PASSWORD_HASH;
  const isPasswordValid = await bcrypt.compare(password, hash);

  if (!user || !user.password || !isPasswordValid) {
    throw new Error(GENERIC_CREDENTIALS_ERROR);
  }

  if (adminOnly && user.role !== "ADMIN") {
    throw new Error(GENERIC_CREDENTIALS_ERROR);
  }

  if (user.role.startsWith("SUSPENDED_")) {
    throw new Error("Your account has been suspended. Please contact the administrator.");
  }

  await clearPersistentRateLimit(attemptKey);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  } as any;
}

const baseOptions: Omit<NextAuthOptions, "providers"> = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if ((user as any).role?.startsWith("SUSPENDED_")) {
        throw new Error("Your account has been suspended. Please contact the administrator.");
      }

      // SSO auto-verify
      if (account?.type === "oauth" && user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { emailVerified: new Date() }
        });
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.emailVerified = (user as { emailVerified?: Date }).emailVerified;
        token.roleCheckedAt = Date.now();
        return token;
      }

      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      const isStale = Date.now() - checkedAt > ROLE_REFRESH_INTERVAL_MS;
      if (!token.id || (trigger !== "update" && !isStale)) return token;

      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, emailVerified: true, passwordChangedAt: true },
      });

      // Deleted or suspended: strip the role so every guard downstream fails.
      // The token stays otherwise intact so next-auth can still expire it
      // normally rather than throwing mid-request.
      if (!current || current.role.startsWith("SUSPENDED_")) {
        token.role = undefined;
        token.roleCheckedAt = Date.now();
        return token;
      }

      // Issued before the password last changed, so it belongs to the session
      // the reset was meant to end. Sessions are stateless JWTs and cannot be
      // deleted server-side; refusing them here is what makes a reset evict
      // whoever was already signed in. The eviction lands within
      // ROLE_REFRESH_INTERVAL_MS, not instantly — lower that constant if the
      // window matters more than the query volume.
      const issuedAtMs = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (current.passwordChangedAt && issuedAtMs < current.passwordChangedAt.getTime()) {
        token.role = undefined;
        token.id = undefined as unknown as string;
        token.roleCheckedAt = Date.now();
        return token;
      }

      token.role = current.role;
      token.emailVerified = current.emailVerified;
      token.roleCheckedAt = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role as string;
        (session.user as any).id = token.id as string;
        (session.user as any).emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
  },
};

export const publicAuthOptions: NextAuthOptions = {
  ...baseOptions,
  secret: PUBLIC_JWT_SECRET,
  jwt: publicJwt,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Public Access",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        captchaId: { label: "Captcha ID", type: "text" },
        captchaCode: { label: "Captcha Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        // Verify Captcha for Sign In
        if (credentials.captchaId && credentials.captchaCode) {
          const isValid = await verifyCaptcha(credentials.captchaId, credentials.captchaCode);
          if (!isValid) throw new Error("Invalid captcha code");
        } else {
          throw new Error("Security verification required");
        }

        return authorizeCredentials(credentials.email, credentials.password, {
          adminOnly: false,
        });
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  cookies: {
    sessionToken: {
      name: PUBLIC_SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `ksa-public.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `ksa-public.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};

export const adminAuthOptions: NextAuthOptions = {
  ...baseOptions,
  secret: ADMIN_JWT_SECRET,
  jwt: adminJwt,
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        captchaId: { label: "Captcha ID", type: "text" },
        captchaCode: { label: "Captcha Code", type: "text" },
        // Honeypot. Real visitors never see or fill this field (it's hidden
        // off-screen in the form); a script that fills every input it finds
        // does. Treated as a bot and rejected before it ever touches the
        // password check or the rate limiter — no point spending either on it.
        website: { label: "Website", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(GENERIC_CREDENTIALS_ERROR);
        }

        if (credentials.website) {
          throw new Error(GENERIC_CREDENTIALS_ERROR);
        }

        // The admin portal is the higher-value target, so it gets the same
        // captcha gate the public sign-in already has — credential-stuffing
        // scripts can otherwise burn through the whole internet's leaked
        // password lists without ever rendering a page.
        if (credentials.captchaId && credentials.captchaCode) {
          const isValid = await verifyCaptcha(credentials.captchaId, credentials.captchaCode);
          if (!isValid) throw new Error("Invalid security code. Please try again.");
        } else {
          throw new Error("Security verification required.");
        }

        return authorizeCredentials(credentials.email, credentials.password, {
          adminOnly: true,
        });
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  cookies: {
    sessionToken: {
      name: ADMIN_SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `ksa-admin.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `ksa-admin.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
