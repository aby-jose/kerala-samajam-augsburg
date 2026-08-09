import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

export async function uploadToCloudinary(file: string | Buffer, folder: string = "events") {
  try {
    const uploadResponse = await cloudinary.uploader.upload(
      typeof file === "string" ? file : `data:image/jpeg;base64,${file.toString("base64")}`,
      {
        folder,
        resource_type: "auto",
      }
    );
    return uploadResponse.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
}
