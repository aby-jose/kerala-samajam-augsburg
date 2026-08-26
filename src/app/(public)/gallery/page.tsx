import React from "react";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/feature-gate";
import { getPageContent } from "@/lib/page-content/actions";
import type { GalleryContentT } from "@/lib/page-content/gallery";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import GalleryLandingClient from "./gallery-landing-client";

export const metadata = {
  title: "Photo Gallery | Kerala Samajam Augsburg (KSA)",
  description:
    "Photos from Kerala Samajam Augsburg's Onam, Vishu and community events — browse albums from the Malayali community in Augsburg, Germany.",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  // Before the query, not after: a switched-off gallery should not be reading
  // albums out of the database to then throw them away.
  await requireFeature("enableGallery");

  const content = (await getPageContent("gallery")) as GalleryContentT;

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

  // Flattened here rather than in the client so the component receives plain
  // data and the totals are counted once on the server.
  const items = albums.map((album) => ({
    id: album.id,
    title: album.title,
    description: album.description,
    category: album.category,
    coverImage: album.coverImage,
    photoCount: album._count.media,
    eventTitle: album.event?.title ?? null,
    // An album tied to an event is dated by the event; a standalone one falls
    // back to when it was created.
    date: (album.event?.date ?? album.createdAt).toISOString(),
  }));

  const photoCount = items.reduce((sum, a) => sum + a.photoCount, 0);

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      <BreadcrumbJsonLd items={[{ name: "Gallery" }]} />
      <GalleryLandingClient albums={items} photoCount={photoCount} content={content} />
    </main>
  );
}
