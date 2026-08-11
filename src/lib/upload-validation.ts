/**
 * What we accept from an upload form.
 *
 * `file.type` is whatever the browser was told to send, so it is a hint and
 * not evidence. Everything here is also checked against the leading bytes of
 * the file, which is what Cloudinary — and anyone later fetching the asset —
 * will actually act on.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_DOCUMENT_BYTES = 1024 * 1024; // 1 MB — student ID cards

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export type UploadKind = "image" | "video" | "media" | "document";

function allowedTypes(kind: UploadKind): string[] {
  switch (kind) {
    case "image":
    case "document":
      return IMAGE_TYPES;
    case "video":
      return VIDEO_TYPES;
    case "media":
      return [...IMAGE_TYPES, ...VIDEO_TYPES];
  }
}

function maxBytes(kind: UploadKind): number {
  switch (kind) {
    case "document":
      return MAX_DOCUMENT_BYTES;
    case "video":
      return MAX_VIDEO_BYTES;
    default:
      return kind === "media" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  }
}

/** Leading-byte signatures for the formats we allow. */
function sniff(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  const ascii = (offset: number, text: string) =>
    [...text].every((ch, i) => bytes[offset + i] === ch.charCodeAt(0));

  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  // ISO base media: ....ftyp<brand> — mp4, quicktime and avif all land here.
  if (ascii(4, "ftyp")) {
    if (ascii(8, "avif") || ascii(8, "avis")) return "image/avif";
    if (ascii(8, "qt")) return "video/quicktime";
    return "video/mp4";
  }
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  return null;
}

export interface ValidatedUpload {
  buffer: Buffer;
  /** The type established from the bytes, not the one the client claimed. */
  contentType: string;
  size: number;
}

/**
 * Read, size-check and type-check an uploaded file.
 *
 * Throws with a message meant for the person uploading — these surface
 * directly in the form.
 */
export async function validateUpload(file: File, kind: UploadKind): Promise<ValidatedUpload> {
  const limit = maxBytes(kind);
  const permitted = allowedTypes(kind);

  if (!file.size) throw new Error("The file is empty.");
  if (file.size > limit) {
    throw new Error(`File is too large. The limit is ${Math.floor(limit / (1024 * 1024))} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `file.size` is metadata and the stream is what
  // actually arrived.
  if (buffer.byteLength > limit) {
    throw new Error(`File is too large. The limit is ${Math.floor(limit / (1024 * 1024))} MB.`);
  }

  const sniffed = sniff(new Uint8Array(buffer.subarray(0, 16)));
  if (!sniffed || !permitted.includes(sniffed)) {
    throw new Error(
      kind === "video" || kind === "media"
        ? "Unsupported file type. Please upload a JPEG, PNG, WebP, GIF or MP4."
        : "Unsupported file type. Please upload a JPEG, PNG, WebP or GIF image."
    );
  }

  return { buffer, contentType: sniffed, size: buffer.byteLength };
}
