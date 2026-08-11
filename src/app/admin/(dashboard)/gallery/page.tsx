import React from "react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/guards";
import GalleryClient from "./gallery-client";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  await requireAdminPage();

  const albums = await prisma.galleryAlbum.findMany({
    include: {
      _count: {
        select: { media: true }
      },
      event: {
        select: { title: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  const events = await prisma.event.findMany({
    where: {
      galleryAlbum: { is: null }, // Only events without an album
    },
    select: {
      id: true,
      title: true,
      date: true,
    },
    orderBy: { date: "desc" },
  });

  return <GalleryClient initialAlbums={albums} availableEvents={events} />;
}
