import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/lib/guards";
import AlbumMediaClient from "./album-media-client";

export const dynamic = "force-dynamic";

export default async function AlbumMediaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("gallery.view");

  const { id } = await params;

  const album = await prisma.galleryAlbum.findUnique({
    where: { id },
    include: {
      media: {
        orderBy: { createdAt: "desc" },
      },
      event: {
        select: { title: true }
      }
    },
  });

  if (!album) {
    notFound();
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  return <AlbumMediaClient album={album} cloudName={cloudName} />;
}
