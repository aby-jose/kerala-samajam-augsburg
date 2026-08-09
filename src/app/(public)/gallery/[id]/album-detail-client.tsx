"use client";

import React, { useState, useRef, useEffect } from "react";
import { Container } from "@/components/layout/container";
import { motion, AnimatePresence } from "framer-motion";
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
      {/* Header */}
      <section className="pt-40 pb-16 border-b border-border/5">
        <Container className="max-w-7xl">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-6">
                <Link 
                  href="/gallery" 
                  className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-primary flex items-center gap-2 transition-all mb-4 group"
                >
                  <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
                  Back to Collection
                </Link>
                <div className="space-y-3">
                  <h1 className="text-4xl md:text-6xl font-serif font-medium leading-[1.1] tracking-tight text-foreground text-balance">
                    {searchResults ? "Search Results" : album.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    {album.event && !searchResults && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
                        <Calendar className="w-4 h-4" />
                        {new Date(album.event.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                    )}
                    {searchResults && (
                      <Button 
                        variant="link" 
                        onClick={() => setSearchResults(null)}
                        className="p-0 h-auto text-[10px] font-bold uppercase tracking-widest text-primary"
                      >
                        Reset Search
                      </Button>
                    )}
                    <span className="h-4 w-px bg-border/50 hidden md:block" />
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {displayMedia.length} Moments
                    </div>
                  </div>
                </div>
                <div className="space-y-4 pt-4">
                   <p className="text-lg text-muted-foreground max-w-2xl font-light leading-relaxed">
                     {searchResults ? "Showing all photos matching the selected face." : (album.description || "Photographs from this gathering, contributed by the people who were there.")}
                   </p>
                   {!searchResults && (
                     <div className="flex flex-col space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Have photos from this event?</p>
                        <p className="text-[11px] text-muted-foreground max-w-sm">Send them in and they will join this album, credited to you, once a moderator has had a look.</p>
                     </div>
                   )}
                </div>
              </div>

              {!searchResults && (
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => {
                      if (!session) {
                        router.push(`${pathname}?auth=login`);
                      } else {
                        setIsFaceSearchOpen(true);
                      }
                    }}
                    className="h-14 px-8 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center gap-2 border border-border/40"
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
                    className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Share your Perspective
                  </Button>
                  <Button className="h-14 w-14 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground flex items-center justify-center border border-border/40">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
           </div>
        </Container>
      </section>

      {/* Masonry Grid */}
      <section className="py-20 bg-background">
        <Container className="max-w-7xl">
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
                  <img 
                    src={media.url} 
                    alt={media.caption || ""}
                    className="w-full h-full object-cover transition-transform duration-2000 group-hover:scale-105"
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
                    <img 
                      src={selectedMedia.url} 
                      alt={selectedMedia.caption || ""}
                      className="max-w-full max-h-[80vh] object-contain"
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
