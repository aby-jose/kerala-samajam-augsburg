"use server";

import { uploadToCloudinary } from "./cloudinary";
import { getAdminUser, getCurrentUser } from "./guards";
import { validateUpload } from "./upload-validation";

export async function uploadProfileImage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  try {
    const { buffer } = await validateUpload(file, "image");
    const imageUrl = await uploadToCloudinary(buffer, "profile_pics");
    return { url: imageUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: error instanceof Error ? error.message : "Failed to upload image" };
  }
}

export async function uploadLogo(formData: FormData) {
  if (!(await getAdminUser())) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  try {
    const { buffer } = await validateUpload(file, "image");
    const imageUrl = await uploadToCloudinary(buffer, "branding");
    return { url: imageUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error: error instanceof Error ? error.message : "Failed to upload logo" };
  }
}
