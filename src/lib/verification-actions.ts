"use server";

import { prisma } from "./prisma";
import { getOTPEmail } from "./email-templates";
import { v2 as cloudinary } from "cloudinary";
import { sendEmail } from "./email";
import { getConfig } from "./config-utils";


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sends a 6-digit verification code to the member's email.
 */
export async function sendVerificationOTP(email: string) {
  if (!email) throw new Error("Email is required");
  const config = await getConfig();

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); 

  try {
    await (prisma as any).verificationToken.upsert({
      where: { identifier_token: { identifier: email, token: code } },
      update: { token: code, expires },
      create: { identifier: email, token: code, expires }
    });

    await sendEmail({
      to: email,
      subject: `Verification Code: ${config.siteName} Membership`,
      html: getOTPEmail(code, { 
        logoUrl: config.branding.logoUrl, 
        siteName: config.siteName,
        primaryColor: config.branding.primaryColor
      })
    });

    return { success: true };
  } catch (error: any) {
    console.error("Verification error:", error);
    throw new Error(error.message || "Failed to process verification");
  }
}

/**
 * Verifies the 6-digit OTP code.
 */
export async function verifyOTP(email: string, code: string) {
  if (!email || !code) throw new Error("Email and code are required");

  try {
    const record = await (prisma as any).verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
        expires: { gte: new Date() }
      }
    });

    if (!record) {
      return { success: false, message: "Invalid or expired verification code" };
    }

    await (prisma as any).verificationToken.delete({
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
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  // Enforce 1MB limit
  if (file.size > 1024 * 1024) {
    throw new Error("File size exceeds 1MB limit. Please compress your image.");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

/**
 * Check if domain is academic (Legacy indicator)
 */
export async function verifyStudentStatus(email: string) {
  if (!email) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;

  try {
    if (domain.endsWith('.edu') || domain.endsWith('.ac.uk') || domain.endsWith('.edu.in')) return true;
    const response = await fetch(`https://raw.githubusercontent.com/Hipotest/university-domains-list/master/world_universities_and_domains.json`);
    if (response.ok) {
      const data = await response.json();
      const isAcademic = data.some((uni: any) => uni.domains.includes(domain));
      if (isAcademic) return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * LEGACY / STUB: Required by some residual components.
 */
export async function initiateSheerIDVerification(email: string) {
  console.log("Legacy SheerID initiation for:", email);
  return { success: true };
}

export async function checkSheerIDStatus(email: string) {
  return { success: false, status: "NOT_FOUND" };
}
