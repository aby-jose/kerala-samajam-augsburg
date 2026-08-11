"use server";

import { z } from "zod";

import { verifyCaptcha, generateCaptcha } from "./captcha";
import { getPasswordResetEmail, getVerificationEmail } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/config-utils";
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
    const config = await getConfig();
    const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL}/verify-email?token=${token}`;
    await sendEmail({
      to: email,
      subject: `Verify Your Email - ${config.siteName}`,
      html: getVerificationEmail(verifyLink, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      }),
    });

    return { success: true, message: "Account created! Please check your email to verify your account." };
  } catch (error) {
    console.error("Registration error:", error);
    return { error: "Failed to create account" };
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

    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    return { success: true };
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
    const config = await getConfig();
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL}/reset-password?token=${token}`;
    
    const emailResult = await sendEmail({
      to: email,
      subject: `Reset Your Password - ${config.siteName}`,
      html: getPasswordResetEmail(resetLink, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      }),
    });

    if (!emailResult.success) {
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
    await prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // 4. Burn every outstanding token for this address, not just the one used,
    // so older reset emails cannot be replayed afterwards.
    await prisma.passwordResetToken.deleteMany({
      where: { email: resetToken.email },
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return { error: "Failed to reset password" };
  }
}
