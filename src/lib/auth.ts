import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { verifyCaptcha } from "./captcha";

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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
        token.emailVerified = (user as { emailVerified?: Date }).emailVerified;
      }
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
  secret: process.env.NEXTAUTH_SECRET,
};

export const publicAuthOptions: NextAuthOptions = {
  ...baseOptions,
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
          const isValid = verifyCaptcha(credentials.captchaId, credentials.captchaCode);
          if (!isValid) throw new Error("Invalid captcha code");
        } else {
          throw new Error("Security verification required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("User not found");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        if (user.role.startsWith("SUSPENDED_")) {
          throw new Error("Your account has been suspended. Please contact the administrator.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        } as any;
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  cookies: {
    sessionToken: {
      name: `ksa-public.session-token`,
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
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Portal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("User not found");
        }

        if (user.role !== "ADMIN") {
          throw new Error("Unauthorized. Admin access required.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        } as any;
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  cookies: {
    sessionToken: {
      name: `ksa-admin.session-token`,
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
