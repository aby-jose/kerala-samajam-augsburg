import React from "react";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/feature-gate";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import AlbumDetailClient from "./album-detail-client";

export const dynamic = "force-dynamic";

// A light, separate query rather than reusing the page's own — that one
// pulls every photo and face record, which generateMetadata has no use for.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const album = await prisma.galleryAlbum.findUnique({
    where: { id, isPublished: true },
    select: { title: true, description: true, coverImage: true },
  });

  if (!album) {
    return { title: "Album Not Found | Kerala Samajam Augsburg (KSA)" };
  }

  const description =
    album.description ||
    `Photos from ${album.title} — Kerala Samajam Augsburg's Malayali community in Augsburg, Germany.`;

  return {
    title: `${album.title} | Gallery | Kerala Samajam Augsburg (KSA)`,
    description,
    openGraph: {
      title: album.title,
      description,
      images: album.coverImage ? [album.coverImage] : undefined,
    },
  };
}

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

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Gallery", url: "/gallery" }, { name: album.title }]} />
      <AlbumDetailClient album={album} />
    </>
  );
}
