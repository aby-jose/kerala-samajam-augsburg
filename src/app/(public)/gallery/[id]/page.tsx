import React from "react";
import { Container } from "@/components/layout/container";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/feature-gate";
import AlbumDetailClient from "./album-detail-client";

export const dynamic = "force-dynamic";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature("enableGallery");

  const { id } = await params;

  const album = await prisma.galleryAlbum.findUnique({
    where: { 
      id,
      isPublished: true 
    },
    include: {
      media: {
        include: { faces: true },
        orderBy: { createdAt: "desc" },
      },
      event: {
        select: { title: true, date: true }
      }
    },
  });

  if (!album) {
    notFound();
  }

  return <AlbumDetailClient album={album} />;
}
