import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

/**
 * Download one gallery asset through our own origin.
 *
 * The `publicId` is resolved against `GalleryMedia` before anything is
 * fetched, and only media belonging to a *published* album resolves. That
 * matters: this route used to sign and stream whatever id it was handed, so
 * `?publicId=student-ids/<id>` returned a member's uploaded ID card, and
 * `branding/…` and `profile_pics/…` were equally reachable. Nothing outside
 * the published gallery is addressable now, so those folders cannot be named
 * at all — and it doubles as a check that we are not acting as an open proxy
 * for arbitrary Cloudinary assets.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get("publicId");

  if (!publicId) {
    return new NextResponse("Missing Public ID", { status: 400 });
  }

  try {
    const media = await prisma.galleryMedia.findFirst({
      where: { publicId, album: { isPublished: true } },
      select: { publicId: true, type: true },
    });

    if (!media) {
      return new NextResponse("Not found", { status: 404 });
    }

    // The stored type decides the resource kind — not the query string, which
    // previously let the caller pick and so widened what could be addressed.
    const isVideo = media.type === "VIDEO";

    const url = cloudinary.url(media.publicId, {
      resource_type: isVideo ? "video" : "image",
      secure: true,
    });

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch media");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();
    const filename = `ksa-${media.publicId.split("/").pop()}.${isVideo ? "mp4" : "jpg"}`;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error("Download proxy error:", error);
    return new NextResponse("Download failed", { status: 500 });
  }
}
