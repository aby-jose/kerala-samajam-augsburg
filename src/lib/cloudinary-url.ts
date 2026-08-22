/**
 * Injects Cloudinary delivery transformations into a `res.cloudinary.com`
 * URL string — no SDK, no env vars, safe to import from client components.
 * Non-Cloudinary URLs (OAuth avatars, empty strings) pass through unchanged.
 *
 * `f_auto,q_auto` asks Cloudinary to pick the best format for the
 * requesting browser (AVIF/WebP where supported) and to compress to the
 * point of visually-lossless rather than shipping the original upload's
 * quality untouched — the single biggest win for content editors' photos,
 * which land at whatever size and quality a phone camera produced.
 * `width` additionally caps delivery to roughly the size the image is ever
 * displayed at, via `c_limit` (never upscales, only shrinks).
 */
export function cloudinaryOptimize(url: string, opts: { width?: number } = {}): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  const params = ["f_auto", "q_auto"];
  if (opts.width) params.push(`w_${opts.width}`, "c_limit");
  return url.replace("/upload/", `/upload/${params.join(",")}/`);
}
