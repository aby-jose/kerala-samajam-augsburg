"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Image as ImageIcon,
  Scan,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import ContributionHubModal from "@/components/gallery/contribution-hub-modal";
import FaceSearchModal from "@/components/gallery/face-search-modal";
import { cn } from "@/lib/utils";
import type { ListingsContentT } from "@/lib/page-content/listings";
import { withAccent } from "@/components/layout/with-accent";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Album {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  coverImage: string | null;
  photoCount: number;
  eventTitle: string | null;
  date: string;
}

/**
 * Shown while the archive is still empty. It says what the albums will hold
 * rather than leaving a dashed box where the pictures should be — drawn from
 * what the society actually runs, so nothing here is a promise we invented.
 */
const ARCHIVE_PREVIEW = [
  {
    title: "Festivals",
    desc: "Onam, Vishu, Christmas and Deepavali — the cooking, the sadhya and the stage.",
  },
  {
    title: "Stage nights",
    desc: "Classical dance, chenda and theatre, from the rehearsal room to the curtain.",
  },
  {
    title: "Trips and get-togethers",
    desc: "Picnics, day trips and the ordinary Sunday meets nobody thinks to photograph.",
  },
];

/** What happens to a contributed photo, spelled out so nobody has to ask. */
const CONTRIBUTION_STEPS = [
  {
    title: "Send them in",
    desc: "Pick the album, drop in as many photos or clips as you like. Phone pictures are welcome.",
  },
  {
    title: "A moderator looks",
    desc: "Someone from the committee checks each one before it goes live, usually within a few days.",
  },
  {
    title: "Published, credited",
    desc: "Your photos join the album under your name, and everyone can download them at full size.",
  },
];

/**
 * Date · category · photo count, as one hairline-divided row. Used on every
 * album treatment below so a card, a ledger row and a tile all label
 * themselves the same way.
 */
function AlbumMeta({
  album,
  tone = "dark",
  className,
}: {
  album: Album;
  tone?: "dark" | "surface";
  className?: string;
}) {
  const bits = [
    format(new Date(album.date), "MMM yyyy"),
    album.category,
    `${album.photoCount} ${album.photoCount === 1 ? "Photo" : "Photos"}`,
  ].filter(Boolean) as string[];

  return (
    <span
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-bold uppercase tracking-[0.2em]",
        tone === "dark" ? "text-white/60" : "text-muted-foreground",
        className
      )}
    >
      {bits.map((bit, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                "h-3 w-px",
                tone === "dark" ? "bg-white/20" : "bg-border"
              )}
            />
          )}
          <span>{bit}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * The cover, or a warm placeholder when an album has none. The placeholder is
 * built on surface-deep so the white overlay type stays readable either way.
 */
function AlbumCover({ album }: { album: Album }) {
  if (!album.coverImage) {
    return (
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center bg-linear-to-br from-primary/45 via-primary/10 to-surface-deep"
      >
        <ImageIcon className="h-16 w-16 text-white/10" strokeWidth={1} />
      </span>
    );
  }

  return (
    <img
      src={album.coverImage}
      alt=""
      loading="lazy"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
    />
  );
}

export default function GalleryLandingClient({
  albums,
  photoCount,
  content,
}: {
  albums: Album[];
  photoCount: number;
  content: ListingsContentT;
}) {
  const reduced = useReducedMotion();
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [activeCategory, setActiveCategory] = React.useState("All");
  const [isContributionModalOpen, setIsContributionModalOpen] =
    React.useState(false);
  const [isFaceSearchOpen, setIsFaceSearchOpen] = React.useState(false);

  // Built from the albums that actually exist — a hardcoded list would print
  // filters that match nothing the moment the categories change in admin.
  const categories = React.useMemo(() => {
    const found = new Set<string>();
    albums.forEach((a) => a.category && found.add(a.category));
    return ["All", ...Array.from(found).sort()];
  }, [albums]);

  // Printed on the filter pills, so a category never looks emptier or fuller
  // than it is before you click it.
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { All: albums.length };
    albums.forEach((a) => {
      if (a.category) counts[a.category] = (counts[a.category] ?? 0) + 1;
    });
    return counts;
  }, [albums]);

  const filteredAlbums =
    activeCategory === "All"
      ? albums
      : albums.filter((a) => a.category === activeCategory);

  // The archive is laid out as a spread rather than a uniform grid: the newest
  // album gets the big frame, the next three read as a ledger beside it, and
  // anything older falls into tiles underneath. With one or two albums the
  // spread simply collapses, so a thin archive still looks composed.
  const [featured, ...others] = filteredAlbums;
  const ledger = others.slice(0, 3);
  const rest = others.slice(3);

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  /** Both gallery tools are members-only, same as on an album page. */
  const requireSession = (open: () => void) => () => {
    if (!session) {
      router.push(`${pathname}?auth=login`);
      return;
    }
    open();
  };

  const stats = [
    { value: albums.length, label: albums.length === 1 ? "Album" : "Albums" },
    { value: photoCount, label: photoCount === 1 ? "Photo" : "Photos" },
  ];

  return (
    <>
      {/* ============ 1. Page header — surface 1 ============ */}
      <section className="bg-surface-1 pb-20 pt-40">
        <Container className="max-w-7xl">
          <motion.div initial="hidden" animate="visible" variants={rise}>
            <PageHeader
              eyebrow={content.galleryHero.eyebrow}
              title={withAccent(content.galleryHero.title, content.galleryHero.accentWord)}
              lead={content.galleryHero.lead}
            />

            {/* The lead promises a face search, so the tool sits right under it
                rather than being buried on an album page. */}
            <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-8 border-t border-border pt-8 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-8">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <span className="block font-sans text-2xl font-extrabold tracking-[-0.03em] text-foreground">
                      {stat.value}
                    </span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button
                  onClick={requireSession(() => setIsFaceSearchOpen(true))}
                  className="group h-12 rounded-full px-8 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all duration-500 hover:-translate-y-0.5"
                >
                  <Scan className="mr-2 h-3.5 w-3.5" />
                  Find My Photos
                </Button>
                <Button
                  variant="outline"
                  onClick={requireSession(() => setIsContributionModalOpen(true))}
                  className="h-12 rounded-full border-border bg-surface-1 px-8 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Camera className="mr-2 h-3.5 w-3.5" />
                  Add Photos
                </Button>
              </div>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ============ 2. The albums — surface 2 ============ */}
      <section
        id="albums-grid"
        className="border-y border-border bg-surface-2 py-24 md:py-32"
      >
        <Container className="max-w-7xl">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-xl">
              <Eyebrow>{content.galleryAlbums.eyebrow}</Eyebrow>
              <SectionTitle className="mt-6">
                {withAccent(content.galleryAlbums.title, content.galleryAlbums.accentWord)}
              </SectionTitle>
            </div>

            {/* Empty by default — see lib/page-content/listings.ts. Rendered
                only when an admin fills it in, so the layout stays exactly as
                it is today until then. */}
            {content.galleryAlbums.lead && (
              <SectionLead className="max-w-sm md:text-right">
                {content.galleryAlbums.lead}
              </SectionLead>
            )}

            {/* Only worth showing once there is more than one thing to filter.
                Scrolls sideways on a phone rather than stacking into four rows
                of pills above the first cover. */}
            {categories.length > 2 && (
              <div className="-mx-6 flex gap-2.5 overflow-x-auto px-6 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] md:mx-0 md:flex-wrap md:justify-end md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full border px-5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98]",
                      activeCategory === cat
                        ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-surface-1 text-muted-foreground hover:border-primary hover:text-foreground"
                    )}
                  >
                    {cat}
                    <span
                      className={cn(
                        "font-mono text-[9px] tracking-normal",
                        activeCategory === cat
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground/50"
                      )}
                    >
                      {categoryCounts[cat] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10 h-px w-full bg-border" />

          {albums.length === 0 ? (
            /* ---------- Nothing published yet ----------
               Built on the same 7/5 spread as a full archive, so an empty
               gallery keeps the page's shape instead of collapsing into a
               dashed rectangle. */
            <motion.div
              className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={rise} className="lg:col-span-7">
                <div className="relative flex min-h-[380px] flex-col justify-center overflow-hidden rounded-[1.5rem] border border-border bg-surface-1 p-6 sm:min-h-[420px] sm:p-9 lg:min-h-[470px]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-primary/[0.09] blur-[110px]"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.11) 1px, transparent 0)",
                      backgroundSize: "26px 26px",
                      maskImage:
                        "radial-gradient(ellipse 75% 70% at 70% 25%, black, transparent)",
                      WebkitMaskImage:
                        "radial-gradient(ellipse 75% 70% at 70% 25%, black, transparent)",
                    }}
                  />

                  <div className="relative">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.08] text-primary">
                      <ImageIcon className="h-5 w-5" strokeWidth={1.6} />
                    </span>

                    <h3 className="mt-7 font-sans text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-3xl md:text-[2.125rem]">
                      The archive starts with <Accent>your</Accent> photos
                    </h3>

                    <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                      Nothing is published yet. The first album goes up as soon
                      as pictures come in from a gathering — if you already have
                      some on your phone, yours can be the one that starts it.
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                      <Button
                        onClick={requireSession(() =>
                          setIsContributionModalOpen(true)
                        )}
                        className="group h-12 w-full rounded-full px-8 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto"
                      >
                        <Camera className="mr-2 h-3.5 w-3.5" />
                        Add the First Album
                        <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                      </Button>
                      <Link href="/events" className="w-full sm:w-auto">
                        <Button
                          variant="outline"
                          className="h-12 w-full rounded-full border-border bg-surface-1 px-8 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground sm:w-auto"
                        >
                          See What&apos;s On
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="lg:col-span-5">
                <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  <span className="h-px w-6 bg-border" />
                  What ends up here
                </span>

                <ul className="mt-2">
                  {ARCHIVE_PREVIEW.map((item, i) => (
                    <motion.li
                      key={item.title}
                      variants={rise}
                      className="flex items-start gap-5 border-t border-border py-6"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 font-sans text-xs font-extrabold tracking-[-0.02em] text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-[17px] font-bold tracking-[-0.015em] text-foreground">
                          {item.title}
                        </span>
                        <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                          {item.desc}
                        </span>
                      </span>
                    </motion.li>
                  ))}

                  <li className="border-t border-border">
                    <span className="block py-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
                      Sorted into albums, searchable by face
                    </span>
                  </li>
                </ul>
              </div>
            </motion.div>
          ) : filteredAlbums.length === 0 ? (
            <div className="mt-16 rounded-[1.5rem] border border-dashed border-border py-20 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-1 text-muted-foreground">
                <ImageIcon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <p className="mt-6 font-sans text-lg font-bold tracking-[-0.015em] text-foreground">
                No albums in this category
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Try another category, or browse everything from the start.
              </p>
              <Button
                variant="outline"
                onClick={() => setActiveCategory("All")}
                className="mt-7 h-11 rounded-full border-border bg-surface-1 px-7 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:border-primary hover:bg-primary hover:text-primary-foreground"
              >
                Show All Albums
              </Button>
            </div>
          ) : (
            <motion.div
              key={activeCategory}
              className="mt-12"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {/* ---------- The spread: one big frame, a ledger beside it ---------- */}
              <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">
                <motion.article
                  variants={rise}
                  className={ledger.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}
                >
                  <Link
                    href={`/gallery/${featured.id}`}
                    className="group relative flex h-full min-h-[400px] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-border bg-surface-deep shadow-sm transition-shadow duration-700 hover:shadow-2xl sm:min-h-[460px] lg:min-h-[540px]"
                  >
                    <AlbumCover album={featured} />

                    {/* Weighted to the bottom third so the picture, not the
                        shade, is what you see first. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 via-45% to-black/5"
                    />

                    <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md sm:left-7 sm:top-7">
                      {featured.eventTitle ? "From the event" : "Latest album"}
                    </span>

                    <span className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all duration-500 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:right-7 sm:top-7">
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                    </span>

                    <div className="relative p-6 sm:p-8">
                      <AlbumMeta album={featured} />

                      <h3 className="mt-4 font-sans text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-3xl md:text-[2.125rem]">
                        {featured.title}
                      </h3>

                      <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-relaxed text-white/65">
                        {featured.description ||
                          featured.eventTitle ||
                          "Photographs contributed by the people who were there."}
                      </p>

                      <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white transition-transform duration-500 group-hover:translate-x-1">
                        View Album
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </span>
                    </div>
                  </Link>
                </motion.article>

                {ledger.length > 0 && (
                  <div className="lg:col-span-5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        <span className="h-px w-6 bg-border" />
                        Also in the archive
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
                        {String(filteredAlbums.length).padStart(2, "0")} TOTAL
                      </span>
                    </div>

                    <ul className="mt-2">
                      {ledger.map((album) => (
                        <motion.li key={album.id} variants={rise}>
                          <Link
                            href={`/gallery/${album.id}`}
                            className="group relative -mx-4 flex items-center gap-5 border-t border-border px-4 py-5 transition-colors duration-300 hover:bg-surface-1"
                          >
                            {/* The rule redraws in primary on hover — same
                                gesture as the ledgers on /about and /events. */}
                            <span
                              aria-hidden
                              className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
                            />

                            <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-deep sm:h-24 sm:w-24">
                              <AlbumCover album={album} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-sans text-[17px] font-bold tracking-[-0.015em] text-foreground">
                                {album.title}
                              </span>
                              <AlbumMeta
                                album={album}
                                tone="surface"
                                className="mt-2.5"
                              />
                            </span>

                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                            </span>
                          </Link>
                        </motion.li>
                      ))}

                      {/* Closes the ledger on a rule, and says outright that
                          there is more below when there is. */}
                      <li className="border-t border-border">
                        {rest.length > 0 ? (
                          <span className="flex items-center gap-2 py-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            {rest.length} more below
                            <ArrowRight className="h-3.5 w-3.5 rotate-90 text-primary" />
                          </span>
                        ) : (
                          <span className="block py-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60">
                            That is the whole archive
                          </span>
                        )}
                      </li>
                    </ul>
                  </div>
                )}
              </div>

              {/* ---------- Everything older, as tiles ---------- */}
              {rest.length > 0 && (
                <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-7">
                  {rest.map((album) => (
                    <motion.article key={album.id} variants={rise}>
                      <Link
                        href={`/gallery/${album.id}`}
                        className="group relative flex aspect-4/3 flex-col justify-end overflow-hidden rounded-[1.5rem] border border-border bg-surface-deep shadow-sm transition-all duration-700 hover:-translate-y-1.5 hover:shadow-2xl"
                      >
                        <AlbumCover album={album} />

                        <div
                          aria-hidden
                          className="absolute inset-0 bg-linear-to-t from-black/90 via-black/35 via-50% to-transparent"
                        />

                        <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white opacity-0 backdrop-blur-md transition-all duration-500 group-hover:opacity-100 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                          <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                        </span>

                        <div className="relative p-5">
                          <h3 className="line-clamp-2 font-sans text-lg font-bold leading-snug tracking-[-0.02em] text-white">
                            {album.title}
                          </h3>
                          <AlbumMeta album={album} className="mt-2.5" />
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </Container>
      </section>

      {/* ============ 3. Contribute — deep band ============ */}
      {/* Same ambient treatment as the join band on the home page and the
          closing bands on /about and /events, so the pages end on one note. */}
      <section className="relative overflow-hidden bg-surface-deep py-24 md:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/4 h-[460px] w-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          }}
        />

        <Container className="relative max-w-7xl">
          <div className="grid grid-cols-1 gap-x-16 gap-y-14 lg:grid-cols-12">
            <motion.div
              className="lg:col-span-5"
              variants={rise}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <Eyebrow tone="dark">{content.galleryContribute.eyebrow}</Eyebrow>

              <SectionTitle tone="dark" className="mt-6">
                {withAccent(content.galleryContribute.title, content.galleryContribute.accentWord)}
              </SectionTitle>

              <SectionLead tone="dark" className="mt-6 max-w-md">
                {content.galleryContribute.lead}
              </SectionLead>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={requireSession(() => setIsContributionModalOpen(true))}
                  className="group h-12 w-full rounded-full px-8 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto"
                >
                  <Camera className="mr-2 h-3.5 w-3.5" />
                  Upload Photos
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
                <Link href="/contact" className="w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                  >
                    Ask a Question First
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* The ledger, matching the events band on /about. */}
            <div className="lg:col-span-7">
              <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                <span className="h-px w-6 bg-white/20" />
                How it works
              </span>

              <motion.ul
                className="mt-2"
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-60px" }}
              >
                {CONTRIBUTION_STEPS.map((step, i) => (
                  <motion.li
                    key={step.title}
                    variants={rise}
                    className="flex items-start gap-5 border-t border-white/10 py-7 sm:gap-6"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] font-sans text-sm font-extrabold tracking-[-0.02em] text-white">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-[17px] font-bold tracking-[-0.015em] text-white">
                        {step.title}
                      </span>
                      <span className="mt-2 block text-sm leading-relaxed text-white/55">
                        {step.desc}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </div>
        </Container>
      </section>

      <ContributionHubModal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
      />

      <FaceSearchModal
        isOpen={isFaceSearchOpen}
        onClose={() => setIsFaceSearchOpen(false)}
      />
    </>
  );
}
