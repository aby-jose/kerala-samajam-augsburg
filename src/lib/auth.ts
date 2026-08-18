import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { verifyCaptcha } from "./captcha";
import { clearPersistentRateLimit, persistentRateLimit } from "./rate-limit";
import { SUSPENDED_ERROR, signInBlockReason } from "./auth-gate";

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

  // Suspension and email verification, in that order. Both are checked only
  // after the password matched, so neither can be used to probe for accounts.
  //
  // An unverified address was previously no obstacle at all: the flag was
  // written at signup, carried in the token and read by two features, but
  // nothing stopped anyone signing in without it — so the verification email
  // was, in practice, optional.
  const blocked = signInBlockReason(user);
  if (blocked) throw new Error(blocked);

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
  /**
   * Mark an account verified the moment a Google identity is attached to it.
   *
   * This cannot be done in `signIn`, which runs *before* next-auth creates the
   * user (see `core/routes/callback.js`) — the previous `user.update` here
   * threw `P2025` for every first-time Google sign-in, because it addressed a
   * row that did not exist yet. Nor can it be done by mapping `emailVerified`
   * in the provider's `profile()`: `callback-handler.js` spreads the profile
   * and then hardcodes `emailVerified: null` over the top of it.
   *
   * `linkAccount` fires after the row exists, in both the new-user and the
   * link-to-existing-user branch, and carries the provider — so it is the one
   * hook that can see both facts at once.
   */
  events: {
    async linkAccount({ user, account }) {
      if (account.type !== "oauth") return;
      await prisma.user.updateMany({
        where: { id: user.id, emailVerified: null },
        data: { emailVerified: new Date() },
      });
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth, `user` is the *provider's profile* — not a database row —
      // until a matching Account row exists, so it carries no role and this
      // check would silently pass for anyone signing in with Google for the
      // first time. The database is the only authority on suspension.
      if (account?.type === "oauth") {
        // Only a provider-verified address may stand in for proof of
        // ownership. Without this, `allowDangerousEmailAccountLinking` earns
        // its name: anyone able to set an arbitrary unverified email on a
        // provider account could claim the member account that uses it.
        //
        // Required of Google specifically, because Google is the only provider
        // that account linking is enabled for. Facebook does not return the
        // claim at all, and demanding it of every provider would make a
        // Facebook sign-in impossible the moment someone configures one.
        if (account.provider === "google") {
          const emailVerifiedByProvider = (profile as { email_verified?: boolean } | undefined)
            ?.email_verified;
          if (emailVerifiedByProvider !== true) {
            throw new Error(
              "Google could not confirm that this email address belongs to you. Sign in with your password instead."
            );
          }
        }

        const email = user.email ?? profile?.email;
        if (!email) throw new Error("Google did not return an email address for this account.");

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { role: true },
        });
        if (existing?.role.startsWith("SUSPENDED_")) throw new Error(SUSPENDED_ERROR);

        return true;
      }

      if ((user as { role?: string }).role?.startsWith("SUSPENDED_")) {
        throw new Error(SUSPENDED_ERROR);
      }

      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.emailVerified = (user as { emailVerified?: Date }).emailVerified;
        token.roleCheckedAt = Date.now();

        // On a first Google sign-in the `user` handed to this callback was
        // built before `events.linkAccount` marked the address verified, so it
        // still carries `emailVerified: null`. Left alone the token would say
        // "unverified" for the whole refresh interval, and a member who just
        // proved their address through Google would be refused by the features
        // that gate on it. One extra read, on sign-in only.
        if (account?.type === "oauth" && token.id) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, emailVerified: true },
          });
          if (fresh) {
            token.role = fresh.role;
            token.emailVerified = fresh.emailVerified;
          }
        }

        return token;
      }

      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      const isStale = Date.now() - checkedAt > ROLE_REFRESH_INTERVAL_MS;
      if (!token.id || (trigger !== "update" && !isStale)) return token;

      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { role: true, emailVerified: true, passwordChangedAt: true },
      });

      // Deleted or suspended: clear both role and id, matching the
      // password-changed branch below. Clearing only the role is not enough —
      // `isSuspended()` in guards.ts is a *negative* check (does the role
      // start with "SUSPENDED_"), and `undefined` fails that check too, so a
      // role-only clear leaves `getCurrentUser()` treating the session as a
      // valid, unsuspended signed-in user for as long as the token lives.
      // Clearing `id` as well is what actually makes `getCurrentUser()`
      // (`!user?.id`) reject it, the same way an evicted-by-password-reset
      // session is rejected.
      if (!current || current.role.startsWith("SUSPENDED_")) {
        token.role = undefined;
        token.id = undefined as unknown as string;
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
            /**
             * Attach Google to the existing account that already uses this
             * address, instead of refusing with `OAuthAccountNotLinked`.
             *
             * A member who signed up with a password and later clicks
             * "Continue with Google" means the same account, and next-auth's
             * default is a dead end they cannot resolve themselves.
             *
             * The name is a fair warning: this is only safe because `signIn`
             * refuses any OAuth profile whose `email_verified` is not true, so
             * the address is always one Google has proven. Do not enable it on
             * a provider without that guarantee.
             */
            allowDangerousEmailAccountLinking: true,
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
