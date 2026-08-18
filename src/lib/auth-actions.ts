"use server";

import { z } from "zod";

import { verifyCaptcha, generateCaptcha } from "./captcha";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { absoluteUrl, sendMail, templates } from "@/lib/email";
import { recordDocumentConsents } from "@/lib/consent-recorder";
import { persistentRateLimit } from "@/lib/rate-limit";

/**
 * Minimum credible password.
 *
 * Neither signup nor reset checked anything at all before — `resetPassword`
 * took `password: any` — so "a" was a valid account password. Length is the
 * one rule that reliably helps; composition rules mostly push people towards
 * `Password1!`, so they are not imposed here.
 */
const PASSWORD_MIN_LENGTH = 12;

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200, "Password is too long.");

/**
 * bcrypt work factor. 10 was the default when this was written; 12 is roughly
 * four times the work and is the current sensible floor for a password hash.
 * Existing hashes keep their original cost and are upgraded on next sign-in
 * only if we ever add re-hashing — new and reset passwords get 12 today.
 */
const BCRYPT_ROUNDS = 12;

export async function getNewCaptcha() {
  return await generateCaptcha();
}

export async function registerUser(formData: any) {
  const { name, email, password, captchaId, captchaCode, acceptedTerms } = formData;

  if (!name || !email || !password || !captchaId || !captchaCode) {
    return { error: "Missing required fields" };
  }

  // Checked server-side as well as in the form: the account is the basis of
  // the contractual relationship, so it must not be created without a record
  // that the terms and privacy policy were accepted.
  if (!acceptedTerms) {
    return { error: "Please accept the Terms of Use and Privacy Policy to continue." };
  }

  const passwordCheck = passwordSchema.safeParse(password);
  if (!passwordCheck.success) {
    return { error: passwordCheck.error.issues[0].message };
  }

  // 1. Verify Captcha
  const isValidCaptcha = await verifyCaptcha(captchaId, captchaCode);
  if (!isValidCaptcha) {
    return { error: "Invalid captcha code" };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "User already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "MEMBER",
        emailVerified: null, // User must verify email
      },
    });

    // Record what was agreed to, at the versions live right now. This is the
    // Art. 7(1) evidence that consent was given, and the baseline the
    // re-consent gate compares future versions against.
    try {
      await recordDocumentConsents(user.id, ["privacy", "terms"], "signup");
    } catch (consentError) {
      // Never fail a signup over the audit write — but make it loud, because
      // a missing record is a compliance gap, not a cosmetic one.
      console.error("Failed to record signup consent:", consentError);
    }

    // 4. Generate Verification Token
    const token = nanoid(32);
    const expires = new Date(Date.now() + 24 * 3600000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    });

    // 5. Send Verification Email
    const sent = await sendMail({
      template: "account.verify-email",
      to: email,
      entityId: user.id,
      build: (ctx) =>
        templates.account.verifyEmail(ctx, {
          verifyLink: absoluteUrl(`/verify-email?token=${token}`),
        }),
    });

    if (!sent.ok) {
      // The account exists and the token is valid, so this is recoverable —
      // but telling somebody to "check your email" when we know nothing was
      // delivered is how an account gets abandoned at the first step.
      return {
        success: true,
        message:
          "Account created, but we could not send the verification email. Use the 'resend verification' link, or contact us if it keeps failing.",
      };
    }

    return { success: true, message: "Account created! Please check your email to verify your account." };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Failed to create account" };
  }
}

/**
 * Send the verification email again.
 *
 * `registerUser` has always told people to "use the resend verification link"
 * on a send failure, and there was no such link — which mattered little while
 * an unverified account could sign in anyway, and matters a great deal now
 * that it cannot. This is the only way back in for someone whose first email
 * bounced, and for the admin portal, which has no other recovery route.
 *
 * The reply never varies. `requestPasswordReset` above is careful not to
 * reveal whether an address has an account, and an endpoint that answered
 * "already verified" for some addresses and "sent" for others would hand back
 * exactly the same information this one line down.
 */
export async function resendVerification(email: string) {
  const normalised = String(email ?? "").trim().toLowerCase();
  const SILENT_OK = {
    success: true,
    message: "If that address needs verifying, we have sent a new link. It is valid for 24 hours.",
  };

  if (!normalised || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) return SILENT_OK;

  try {
    // Counted per address, like the password reset. Without it this action is
    // a free mail cannon: one unauthenticated call per request, addressed to
    // anyone, from our sending domain and our reputation.
    const { ok } = await persistentRateLimit(`verifyresend:${normalised}`, 3, 60 * 60 * 1000);
    if (!ok) return SILENT_OK;

    const user = await prisma.user.findUnique({ where: { email: normalised } });
    if (!user || user.emailVerified) return SILENT_OK;

    // Drop any earlier tokens for this address. They stay valid for 24 hours
    // otherwise, so a mailbox that has accumulated three of them offers three
    // live ways in long after the member used the newest.
    await prisma.verificationToken.deleteMany({ where: { identifier: normalised } });

    const token = nanoid(32);
    await prisma.verificationToken.create({
      data: { identifier: normalised, token, expires: new Date(Date.now() + 24 * 3600000) },
    });

    await sendMail({
      template: "account.verify-email",
      to: normalised,
      entityId: user.id,
      build: (ctx) =>
        templates.account.verifyEmail(ctx, {
          verifyLink: absoluteUrl(`/verify-email?token=${token}`),
        }),
    });

    return SILENT_OK;
  } catch (error) {
    console.error("Resend verification error:", error);
    return SILENT_OK;
  }
}

export async function verifyEmail(token: string) {
  if (!token) return { error: "Missing token" };

  try {
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return { error: "Invalid or expired verification link" };
    }

    const user = await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    // Welcome them properly. `once` guards it: the verification link can be
    // clicked twice, and a second welcome reads as a system with a stutter.
    if (user.email) {
      await sendMail({
        template: "account.welcome",
        to: user.email,
        entityId: user.id,
        once: true,
        build: (ctx) => templates.account.welcome(ctx, { name: user.name || "there" }),
      });
    }

    // The role, so the page can send an administrator back to `/admin/login`
    // instead of the public sign-in it defaults to. An admin who just
    // reverified a changed address (`updateProfile`) signs in on a different
    // portal, with a different session cookie, from every other member.
    return { success: true, role: user.role };
  } catch (error) {
    console.error("Email verification error:", error);
    return { error: "Failed to verify email" };
  }
}

export async function requestPasswordReset(email: string) {
  if (!email) return { error: "Email is required" };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      // Don't reveal if user doesn't exist for security, but we can't send an email
      return { success: true };
    }

    // Counted properly rather than by "how many unexpired tokens exist" — that
    // form also locked out the legitimate owner, because their own three
    // requests left three live tokens and blocked the fourth for an hour.
    const { ok } = await persistentRateLimit(
      `pwreset:${email.trim().toLowerCase()}`,
      3,
      60 * 60 * 1000
    );
    if (!ok) {
      return { error: "Too many requests. Please try again later." };
    }

    // Generate token
    const token = nanoid(32);
    const expires = new Date(Date.now() + 3600000); // 1 hour

    // Save token to DB
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send email
    const emailResult = await sendMail({
      template: "account.password-reset",
      to: email,
      entityId: user.id,
      build: (ctx) =>
        templates.account.passwordReset(ctx, {
          resetLink: absoluteUrl(`/reset-password?token=${token}`),
        }),
    });

    if (!emailResult.ok) {
      return { error: "Failed to send reset email. Please try again later." };
    }

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return { error: "Failed to process request" };
  }
}

export async function resetPassword(token: string, password: string) {
  if (!token || !password) return { error: "Missing required fields" };

  const passwordCheck = passwordSchema.safeParse(password);
  if (!passwordCheck.success) {
    return { error: passwordCheck.error.issues[0].message };
  }

  try {
    // 1. Verify token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { error: "Invalid or expired token" };
    }

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // 3. Update user. `passwordChangedAt` is what evicts sessions that were
    // already signed in — a reset that leaves an attacker's session live is
    // not a recovery.
    const changedAt = new Date();
    const user = await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword, passwordChangedAt: changedAt },
    });

    // 4. Burn every outstanding token for this address, not just the one used,
    // so older reset emails cannot be replayed afterwards.
    await prisma.passwordResetToken.deleteMany({
      where: { email: resetToken.email },
    });

    // 5. Tell the owner.
    //
    // The reset link arrives by email, so an attacker who reaches this point
    // already reads the member's inbox — which is precisely why the notice is
    // worth sending. It is the moment the real owner finds out, and without it
    // the first sign of a takeover is being unable to sign in.
    await sendMail({
      template: "account.password-changed",
      to: resetToken.email,
      entityId: user.id,
      build: (ctx) =>
        templates.account.passwordChanged(ctx, { name: user.name || "there", changedAt }),
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Failed to reset password" };
  }
}
