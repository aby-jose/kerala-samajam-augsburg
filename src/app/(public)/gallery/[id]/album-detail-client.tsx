"use client";

import React, { useState, useRef, useEffect } from "react";
import { Container } from "@/components/layout/container";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import NextImage from "next/image";
import { 
  X, 
  ChevronLeft, 
  Download, 
  Maximize2,
  Calendar,
  Share2,
  Video as VideoIcon,
  Play,
  Search,
  Camera,
  ChevronRight,
  CalendarDays,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FaceSearchModal from "@/components/gallery/face-search-modal";
import ContributionModal from "@/components/gallery/contribution-modal";
import UploadProgressPill, { UploadTask } from "@/components/gallery/upload-progress-pill";
import { searchMediaByFace, checkContributionEligibility, uploadImageAction, submitMediaContribution, submitBulkMediaContributions } from "@/lib/gallery-actions";
import { useToast } from "@/components/ui/toast";
import { Eyebrow, PageTitle } from "@/components/layout/section-heading";
import type { LucideIcon } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

const DOT_GRID: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
  backgroundSize: "28px 28px",
  maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
  WebkitMaskImage:
    "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
};

function HeroMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-primary sm:h-9 sm:w-9">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </p>
        <p className="mt-1 break-words font-sans text-sm font-bold tracking-[-0.015em] text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function AlbumDetailClient({ album }: { album: any }) {
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [isFaceSearchOpen, setIsFaceSearchOpen] = useState(false);
  const [isContributionOpen, setIsContributionOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, dismiss, success, error } = useToast();
  const [copied, setCopied] = useState(false);

  const reduced = useReducedMotion();
  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: album.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  // Background Upload State
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [showUploadPill, setShowUploadPill] = useState(false);
  const [isPillExpanded, setIsPillExpanded] = useState(false);

  useEffect(() => {
    if (searchParams.get("contribute") === "true" && session) {
      setIsContributionOpen(true);
    }
  }, [searchParams, session]);

  const handleDownload = (media: any) => {
    window.location.href = `/api/gallery/download?publicId=${encodeURIComponent(media.publicId)}&type=${encodeURIComponent(media.type)}`;
  };

  const handleFaceClick = async (descriptor: number[]) => {
    if (!session) {
      router.push(`${pathname}?auth=login`);
      return;
    }
    const toastId = loading("Finding matching moments...");
    try {
      const matches = await searchMediaByFace(descriptor);
      setSearchResults(matches);
      if (matches.length > 0) {
        success(`Found ${matches.length} matching moments!`);
      } else {
        error("No other matches found.");
      }
    } catch (err) {
      console.error("Face search failed:", err);
      error("Search failed.");
    } finally {
      dismiss(toastId);
    }
  };

  const handleContributionUpload = async (files: File[]) => {
    setShowUploadPill(true);
    setIsPillExpanded(false);
    
    const newTasks: UploadTask[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      progress: 0,
      status: "uploading"
    }));
    
    setUploadQueue(prev => [...prev, ...newTasks]);

    const uploadedItems: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const task = newTasks[i];
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        // 1. Upload to Cloudinary
        const uploadRes = await uploadImageAction(formData, `kerala-samajam/contributions/${album.id}`) as any;
        if (uploadRes.error) throw new Error(uploadRes.error);
        
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: "processing", progress: 80 } : t));

        uploadedItems.push({
          url: uploadRes.url,
          publicId: uploadRes.publicId,
          type: file.type.startsWith("video") ? "VIDEO" : "IMAGE",
          width: uploadRes.width,
          height: uploadRes.height,
        });

      } catch (err) {
        console.error("Contribution upload failed:", err);
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: "error", progress: 0 } : t));
      }
    }

    // 2. Submit all for moderation as a batch
    if (uploadedItems.length > 0) {
      try {
        await submitBulkMediaContributions(album.id, uploadedItems);
        // Mark all successfully uploaded items as success in the queue
        setUploadQueue(prev => prev.map(t => t.status === "processing" ? { ...t, status: "success", progress: 100 } : t));
      } catch (err) {
        console.error("Bulk contribution submission failed:", err);
        error("Failed to finalize contributions.");
      }
    }
  };

  const displayMedia = searchResults || album.media;

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5 pb-32">
      {/* ============ 1. Hero — the cover, at full volume ============ */}
      <section className="relative isolate overflow-hidden bg-surface-deep pb-14 pt-24 sm:pt-28 md:pb-28 md:pt-36">
        {album.coverImage && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <NextImage
              src={album.coverImage}
              alt=""
              aria-hidden
              fill
              sizes="100vw"
              className="scale-125 object-cover opacity-40 blur-[80px]"
            />
          </div>
        )}

        {/* Scrims */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/75 via-black/70 to-black/92"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/4 h-[520px] w-[680px] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={DOT_GRID}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <Container className="relative max-w-7xl">
          <nav className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
            <Link
              href="/gallery"
              className="transition-colors duration-300 hover:text-white"
            >
              Gallery
            </Link>
            <ChevronRight className="h-3 w-3 text-white/35" strokeWidth={2.5} />
            <span className="text-white/90">{album.category || "Collection"}</span>
          </nav>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-6 grid grid-cols-1 gap-x-16 gap-y-8 sm:mt-8 sm:gap-y-10 md:mt-10 lg:grid-cols-12 lg:items-center"
          >
            {/* ---------------- The details ---------------- */}
            <motion.div variants={rise} className="lg:col-span-7">
              <Eyebrow tone="dark">{searchResults ? "Search Matches" : "Photo Album"}</Eyebrow>

              <PageTitle tone="dark" className="mt-5 sm:mt-7">
                {searchResults ? "Search Results" : album.title}
              </PageTitle>

              <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4 border-y border-white/10 py-5 sm:mt-8 sm:gap-x-10 sm:py-6 md:mt-9 md:py-7">
                {album.event && !searchResults && (
                  <HeroMeta
                    icon={CalendarDays}
                    label="Event Date"
                    value={new Date(album.event.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  />
                )}
                <HeroMeta
                  icon={ImageIcon}
                  label="Moments"
                  value={`${displayMedia.length} Photos & Videos`}
                />
              </div>

              <div className="mt-6 space-y-4">
                <p className="text-[15px] leading-relaxed md:text-base text-white/80 max-w-2xl font-light">
                  {searchResults ? "Showing all photos matching the selected face." : (album.description || "Photographs from this gathering, contributed by the people who were there.")}
                </p>
                {!searchResults && (
                  <div className="flex flex-col space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Have photos from this event?</p>
                    <p className="text-xs text-white/60 max-w-sm">Send them in and they will join this album, credited to you, once a moderator has approved.</p>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                {!searchResults && (
                  <>
                    <Button 
                      onClick={() => {
                        if (!session) {
                          router.push(`${pathname}?auth=login`);
                        } else {
                          setIsFaceSearchOpen(true);
                        }
                      }}
                      className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-white/[0.06] hover:bg-white/15 text-white font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2 border border-white/10 w-full sm:w-auto shrink-0"
                    >
                      <Search className="w-4 h-4" />
                      {session ? "Find My Photos" : "Sign in to find photos"}
                    </Button>
                    <Button 
                      onClick={async () => {
                        if (!session) {
                          router.push(`${pathname}?auth=login`);
                          return;
                        }
                        
                        const tid = loading("Checking eligibility...");
                        try {
                          const { eligible, message } = await checkContributionEligibility(album.id);
                          if (eligible) {
                            setIsContributionOpen(true);
                          } else {
                            error(message || "You are not eligible to contribute to this album.");
                          }
                        } catch (err) {
                          error("Failed to verify eligibility.");
                        } finally {
                          dismiss(tid);
                        }
                      }}
                      className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      Share your Perspective
                    </Button>
                    <Button 
                      onClick={handleShare}
                      className="h-12 sm:h-14 w-full sm:w-14 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400 animate-pulse" strokeWidth={2.4} />
                      ) : (
                        <Share2 className="w-4 h-4" strokeWidth={2.2} />
                      )}
                    </Button>
                  </>
                )}
                {searchResults && (
                  <Button 
                    onClick={() => setSearchResults(null)}
                    className="h-12 sm:h-14 px-6 sm:px-8 rounded-full bg-secondary hover:bg-secondary/90 text-foreground font-bold uppercase tracking-[0.2em] text-[10px] transition-all w-full sm:w-auto"
                  >
                    Reset Search
                  </Button>
                )}
              </div>
            </motion.div>

            {/* ---------------- The cover artwork ---------------- */}
            <motion.div variants={rise} className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/60 aspect-4/3 flex items-center justify-center">
                {album.coverImage ? (
                  <NextImage
                    src={album.coverImage}
                    alt={album.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 40vw, 90vw"
                    className="object-cover"
                  />
                ) : (
                  <ImageIcon className="h-20 w-20 text-white/10" strokeWidth={1} />
                )}
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>      {/* Masonry Grid */}
      <section className="py-20 bg-background flex-grow flex items-center justify-center">
        <Container className="max-w-7xl w-full">
          {displayMedia.length === 0 ? (
            <div className="mx-auto max-w-md text-center py-16 px-4 space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h3 className="font-sans text-xl font-bold tracking-[-0.02em] text-foreground">
                  {searchResults ? "No Matches Found" : "No Moments Yet"}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {searchResults 
                    ? "We couldn't find any photos matching this face. Try searching for a different person." 
                    : "No one has shared any photos from this event yet. If you have some, share your perspective!"}
                </p>
              </div>
              {!searchResults && (
                <Button 
                  onClick={async () => {
                    if (!session) {
                      router.push(`${pathname}?auth=login`);
                      return;
                    }
                    const tid = loading("Checking eligibility...");
                    try {
                      const { eligible, message } = await checkContributionEligibility(album.id);
                      if (eligible) {
                        setIsContributionOpen(true);
                      } else {
                        error(message || "You are not eligible to contribute to this album.");
                      }
                    } catch (err) {
                      error("Failed to verify eligibility.");
                    } finally {
                      dismiss(tid);
                    }
                  }}
                  className="rounded-full h-11 px-6 bg-primary hover:bg-primary/90 text-white font-semibold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                >
                  Upload the First Photo
                </Button>
              )}
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
              {displayMedia.map((media: any) => (
                <motion.div
                  key={media.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="break-inside-avoid group relative rounded-[2rem] overflow-hidden bg-muted border border-border/10 transition-[transform,opacity,box-shadow] duration-500 hover:shadow-2xl cursor-zoom-in"
                  onClick={() => setSelectedMedia(media)}
                >
                  {media.type === "IMAGE" ? (
                    <NextImage
                      src={media.url}
                      alt={media.caption || ""}
                      width={media.width || 800}
                      height={media.height || 800}
                      sizes="(min-width: 1280px) 23vw, (min-width: 640px) 48vw, 96vw"
                      className="w-full h-auto object-cover transition-transform duration-2000 group-hover:scale-105"
                    />
                  ) : (
                    <div className="relative group/video">
                      <video 
                        src={media.url}
                        muted
                        loop
                        playsInline
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => e.currentTarget.pause()}
                        className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-[filter,transform] duration-500"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity">
                        <div className="h-14 w-14 rounded-full bg-black/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                          <Play className="w-6 h-6 fill-white" />
                        </div>
                      </div>
                      <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-white flex items-center gap-1">
                        <VideoIcon className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Video</span>
                      </div>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 truncate mr-4">
                        {media.caption || "View Moment"}
                      </p>
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* Premium Lightbox Modal */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <div className="absolute top-8 right-8 flex items-center gap-4 z-50">
              <Button 
                onClick={() => handleDownload(selectedMedia)}
                className="h-12 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md font-bold uppercase tracking-[0.2em] text-[10px]"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <button 
                className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 backdrop-blur-md"
                onClick={() => setSelectedMedia(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <motion.div
              layoutId={`media-${selectedMedia.id}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative group/lightbox overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl">
                {selectedMedia.type === "IMAGE" ? (
                  <>
                    <NextImage
                      src={selectedMedia.url}
                      alt={selectedMedia.caption || ""}
                      width={selectedMedia.width || 1200}
                      height={selectedMedia.height || 1200}
                      sizes="90vw"
                      className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                    />
                    {/* Interactive Face Boxes */}
                    {selectedMedia.faces?.map((face: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleFaceClick(face.descriptor);
                          setSelectedMedia(null);
                        }}
                        className="absolute border-2 border-primary/50 hover:border-primary hover:bg-primary/20 transition-all rounded-lg group/face cursor-pointer flex items-center justify-center"
                        style={{
                          left: `${(face.boundingBox.x / selectedMedia.width) * 100}%`,
                          top: `${(face.boundingBox.y / selectedMedia.height) * 100}%`,
                          width: `${(face.boundingBox.width / selectedMedia.width) * 100}%`,
                          height: `${(face.boundingBox.height / selectedMedia.height) * 100}%`,
                        }}
                      >
                        <div className="bg-primary text-white text-[8px] font-bold px-1 rounded opacity-0 group-hover/face:opacity-100 transition-opacity absolute -top-5 whitespace-nowrap">
                          Search Face
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <video 
                    src={selectedMedia.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[80vh]"
                  />
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FaceSearchModal 
        isOpen={isFaceSearchOpen}
        onClose={() => setIsFaceSearchOpen(false)}
        albumId={album.id}
      />

      <ContributionModal 
        isOpen={isContributionOpen}
        onClose={() => setIsContributionOpen(false)}
        onUpload={handleContributionUpload}
        albumTitle={album.title}
      />

      <UploadProgressPill 
        tasks={uploadQueue}
        isVisible={showUploadPill}
        isExpanded={isPillExpanded}
        onToggleExpand={() => setIsPillExpanded(!isPillExpanded)}
        onClose={() => {
          setShowUploadPill(false);
          setUploadQueue([]);
          setIsPillExpanded(false);
        }}
      />
    </main>
  );
}
