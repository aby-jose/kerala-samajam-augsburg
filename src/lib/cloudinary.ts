import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

export async function uploadToCloudinary(file: string | Buffer, folder: string = "events") {
  // A string is already a URL or data URL — Cloudinary fetches/decodes it
  // as-is, so its declared type (if any) is whatever the caller gave it.
  if (typeof file === "string") {
    try {
      const uploadResponse = await cloudinary.uploader.upload(file, {
        folder,
        resource_type: "auto",
      });
      return uploadResponse.secure_url;
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw new Error("Failed to upload image to Cloudinary");
    }
  }

  // A Buffer is raw file bytes of whatever type it actually is. Streaming it
  // lets Cloudinary sniff the real format instead of us asserting one —
  // wrapping it as `data:image/jpeg;base64,...` here used to mislabel every
  // PNG/WebP/GIF/AVIF upload as a JPEG.
  return new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "auto" }, (error, result) => {
        if (error || !result) {
          console.error("Cloudinary upload error:", error);
          reject(new Error("Failed to upload image to Cloudinary"));
          return;
        }
        resolve(result.secure_url);
      })
      .end(file);
  });
}
