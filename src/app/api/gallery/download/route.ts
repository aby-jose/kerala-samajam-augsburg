import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicId = searchParams.get("publicId");
  const type = searchParams.get("type") || "IMAGE";

  if (!publicId) {
    return new NextResponse("Missing Public ID", { status: 400 });
  }

  try {
    // Generate the secure URL on the server
    const url = cloudinary.url(publicId, {
      resource_type: type === "VIDEO" ? "video" : "image",
      secure: true,
    });

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch media");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();
    const filename = `ksa-${publicId.split("/").pop()}.${type === "VIDEO" ? "mp4" : "jpg"}`;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error("Download proxy error:", error);
    return new NextResponse("Download failed", { status: 500 });
  }
}
