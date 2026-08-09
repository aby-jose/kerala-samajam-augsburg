"use server";

import { uploadToCloudinary } from "./cloudinary";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";

import { adminAuthOptions } from "./auth";

export async function uploadProfileImage(formData: FormData) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageUrl = await uploadToCloudinary(buffer, "profile_pics");
    return { url: imageUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: "Failed to upload image" };
  }
}

export async function uploadLogo(formData: FormData) {
  const session = await getServerSession(adminAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const imageUrl = await uploadToCloudinary(buffer, "branding");
    return { url: imageUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: "Failed to upload logo" };
  }
}
