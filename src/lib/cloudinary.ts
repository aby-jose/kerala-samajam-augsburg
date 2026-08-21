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

/**
 * Deletes an asset uploaded via `uploadToCloudinary` by its `secure_url`.
 *
 * Cloudinary's destroy API takes a `public_id` + `resource_type`, not a URL —
 * and unlike gallery uploads (which stash `publicId` on the row at upload
 * time), callers like reel caching only ever kept the `secure_url`. Both are
 * recoverable from it: `.../​<resource_type>/upload/[v<version>/]<public_id>.<ext>`,
 * and the resource_type segment is whatever Cloudinary itself resolved
 * `resource_type: "auto"` to, so it's reliable even though the original
 * upload call never said image vs video.
 *
 * Best-effort — logs and returns rather than throwing, since an orphaned
 * Cloudinary asset isn't worth failing the caller's own operation over.
 */
export async function deleteFromCloudinary(url: string): Promise<void> {
  const match = url.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  if (!match) {
    console.error("Cloudinary delete skipped — could not parse public_id from URL:", url);
    return;
  }
  const [, resourceType, publicId] = match;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
  }
}

/**
 * Recursively collects every Cloudinary delivery URL found anywhere inside
 * an arbitrary JSON value.
 *
 * Built for the generic content-save actions (home/about/page content),
 * which each store an admin-edited layout as one freeform JSON blob with no
 * fixed schema saying which key is a hero video vs. plain text — so there's
 * no field name to check for a media URL, only the URL's own shape.
 */
function collectCloudinaryUrls(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    if (value.includes("res.cloudinary.com") && value.includes("/upload/")) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectCloudinaryUrls(item, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectCloudinaryUrls(v, out);
  }
  return out;
}

/**
 * Deletes whatever Cloudinary assets were referenced in `oldValue` but no
 * longer appear anywhere in `newValue` — the cleanup half of overwriting a
 * whole content blob in one `upsert`, which otherwise silently orphans a
 * replaced hero video or removed image the moment the save succeeds.
 * Best-effort and non-blocking: `deleteFromCloudinary` logs and swallows its
 * own failures rather than throwing, so a save is never undone by this.
 */
export async function pruneOrphanedCloudinaryUrls(oldValue: unknown, newValue: unknown): Promise<void> {
  const oldUrls = collectCloudinaryUrls(oldValue);
  const newUrls = collectCloudinaryUrls(newValue);
  const orphaned = [...oldUrls].filter((url) => !newUrls.has(url));
  await Promise.all(orphaned.map((url) => deleteFromCloudinary(url)));
}
