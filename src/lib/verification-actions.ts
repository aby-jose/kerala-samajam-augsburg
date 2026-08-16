"use server";

import { randomInt } from "crypto";

import { prisma } from "./prisma";
import { v2 as cloudinary } from "cloudinary";
import { sendMail, templates } from "./email";
import { requireUser } from "./guards";
import { validateUpload } from "./upload-validation";


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sends a 6-digit verification code to the signed-in member's own address.
 *
 * The address is taken from the session rather than an argument. As a
 * parameter it let anyone mail a code to any address on the internet, and —
 * paired with `verifyOTP` — mark any account as verified.
 */
export async function sendVerificationOTP() {
  const user = await requireUser();
  const email = user.email;
  if (!email) throw new Error("Your account has no email address");

  const code = randomInt(100000, 1000000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Every previous code for this address stops working now. The old `upsert`
    // was keyed on `[identifier, token]`, and the token *is* the fresh random
    // code — so it never matched an existing row and every call left another
    // live code behind. Enough calls and guessing six digits stops being hard.
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    await prisma.verificationToken.create({
      data: { identifier: email, token: code, expires }
    });

    // The result is checked rather than discarded: a member staring at a code
    // entry box with no code in their inbox needs to be told to try again, not
    // left to guess whether it is slow or broken.
    const sent = await sendMail({
      template: "account.otp",
      to: email,
      entityId: user.id,
      build: (ctx) => templates.account.otpCode(ctx, { code }),
    });

    if (!sent.ok) {
      throw new Error("We could not send your code. Please try again in a moment.");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Verification error:", error);
    throw new Error(error.message || "Failed to process verification");
  }
}

/**
 * Verifies the 6-digit OTP code.
 */
export async function verifyOTP(code: string) {
  const user = await requireUser();
  const email = user.email;
  if (!email) throw new Error("Your account has no email address");
  if (!code) throw new Error("A verification code is required");

  try {
    const record = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
        expires: { gte: new Date() }
      }
    });

    if (!record) {
      return { success: false, message: "Invalid or expired verification code" };
    }

    await prisma.verificationToken.delete({
      where: { id: record.id }
    });

    // MARK USER AS VERIFIED IN DATABASE
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() }
    });

    return { success: true };
  } catch (error: any) {
    console.error("OTP verification error:", error);
    throw new Error("Verification failed");
  }
}

/**
 * Uploads Student ID card to Cloudinary.
 * Enforces < 1MB limit.
 */
export async function uploadStudentId(formData: FormData) {
  await requireUser();

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  // 1 MB cap and an image-only check, both enforced against the actual bytes.
  const { buffer } = await validateUpload(file, "document");

  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "student-ids",
          resource_type: "image",
          transformation: [{ quality: "auto", fetch_format: "auto" }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result?.secure_url, publicId: result?.public_id });
        }
      ).end(buffer);
    });
  } catch (error) {
    console.error("Upload error:", error);
    throw new Error("Failed to upload document");
  }
}

/*
 * Removed: `verifyStudentStatus`, `initiateSheerIDVerification` and
 * `checkSheerIDStatus`.
 *
 * The two SheerID functions were stubs returning canned values — one logged
 * and claimed success, the other always answered NOT_FOUND — and their comment
 * said they were "required by some residual components". Nothing imported any
 * of the three. As exported actions they were public endpoints that did
 * nothing, and a stub that reports success is worse than an absent feature,
 * because a caller cannot tell the difference.
 *
 * `verifyStudentStatus` also fetched a third-party JSON list from GitHub on
 * every call, uncached, so an unauthenticated action could make us hammer
 * someone else's raw.githubusercontent.com.
 *
 * Student status is verified today by an administrator reviewing the uploaded
 * ID in /admin/membership/applications — `uploadStudentId` above feeds that
 * queue. If SheerID is ever wired up for real, it belongs behind that same
 * review flow. `SHEERID_API_KEY` and `SHEERID_PROGRAM_ID` in .env are unused
 * and can go.
 */
