import React from "react";
import { Container } from "@/components/layout/container";
import { prisma } from "@/lib/prisma";
import GalleryLandingClient from "./gallery-landing-client";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const albums = await prisma.galleryAlbum.findMany({
    where: { isPublished: true },
    include: {
      _count: {
        select: { media: true }
      },
      event: {
        select: { title: true, date: true }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      <GalleryLandingClient initialAlbums={albums} />
    </main>
  );
}
