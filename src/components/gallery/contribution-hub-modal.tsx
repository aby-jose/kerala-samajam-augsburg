"use client";

import React, { useState, useEffect } from "react";
import {
   X,
   Sparkles,
   Loader2,
   ChevronRight,
   Camera,
   Calendar,
   AlertCircle,
   ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getEligibleAlbumsForContribution } from "@/lib/gallery-actions";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ContributionHubModalProps {
   isOpen: boolean;
   onClose: () => void;
}

export default function ContributionHubModal({ isOpen, onClose }: ContributionHubModalProps) {
   const { data: session, status } = useSession();
   const router = useRouter();
   const pathname = usePathname();
   const [albums, setAlbums] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
      if (isOpen && session) {
         fetchEligibleAlbums();
      }
   }, [isOpen, session]);

   const fetchEligibleAlbums = async () => {
      setIsLoading(true);
      try {
         const data = await getEligibleAlbumsForContribution();
         setAlbums(data);
      } catch (err) {
         console.error("Failed to fetch eligible albums:", err);
      } finally {
         setIsLoading(false);
      }
   };

   const handleAlbumSelect = (albumId: string) => {
      router.push(`/gallery/${albumId}?contribute=true`);
      onClose();
   };

   const handleLoginTrigger = () => {
      router.push(`${pathname}?auth=login`);
      onClose();
   };

   return (
      <AnimatePresence>
         {isOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md"
                  onClick={onClose}
               />

               <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-2xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
               >
                  {/* Header */}
                  <div className="p-8 border-b border-border bg-secondary/5 flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                           <Camera className="w-6 h-6" />
                        </div>
                        <div>
                           <h3 className="text-xl font-bold tracking-tight">Contribution Hub</h3>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Select an event you attended</p>
                        </div>
                     </div>
                     <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8">
                     {status === "unauthenticated" ? (
                        <div className="py-12 flex flex-col items-center text-center space-y-6">
                           <div className="h-20 w-20 bg-primary/5 rounded-full flex items-center justify-center text-primary">
                              <Camera className="w-10 h-10" />
                           </div>
                           <div className="space-y-2">
                              <h4 className="text-xl font-bold">Join the Collective</h4>
                              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                 Sign in to see events you&apos;ve attended and share your captured moments with the community.
                              </p>
                           </div>
                           <Button onClick={handleLoginTrigger} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">
                              Sign In to Continue
                           </Button>
                        </div>
                     ) : isLoading ? (
                        <div className="py-24 flex flex-col items-center justify-center space-y-4">
                           <Loader2 className="w-8 h-8 animate-spin text-primary" />
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Identifying eligible albums...</p>
                        </div>
                     ) : albums.length === 0 ? (
                        <div className="py-12 flex flex-col items-center text-center space-y-6">
                           <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center text-muted-foreground/30">
                              <Calendar className="w-10 h-10" />
                           </div>
                           <div className="space-y-2">
                              <h4 className="text-xl font-bold">No Attended Events Found</h4>
                              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                 You can only contribute to events you have officially attended and checked-in for. Browse the gallery to enjoy moments captured by others!
                              </p>
                           </div>
                           <Button variant="outline" onClick={onClose} className="h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-widest">
                              Browse Gallery
                           </Button>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 gap-4">
                           {albums.map((album) => (
                              <button
                                 key={album.id}
                                 onClick={() => handleAlbumSelect(album.id)}
                                 className="group flex items-center gap-6 p-4 rounded-3xl bg-secondary/5 border border-border hover:border-primary/20 hover:bg-primary/5 transition-all text-left"
                              >
                                 <div className="h-20 w-20 rounded-2xl overflow-hidden bg-muted shrink-0 border border-border/10">
                                    {album.coverImage ? (
                                       <img src={album.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    ) : (
                                       <div className="w-full h-full flex items-center justify-center text-muted-foreground/20"><ImageIcon className="w-8 h-8" /></div>
                                    )}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-base truncate">{album.title}</h4>
                                    <div className="flex items-center gap-4 mt-1.5">
                                       <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                          <Calendar className="w-3 h-3" />
                                          {album.event?.date ? new Date(album.event.date).toLocaleDateString() : "Event Album"}
                                       </div>
                                       <div className="h-1 w-1 rounded-full bg-border" />
                                       <div className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                          {album._count.media} Moments
                                       </div>
                                    </div>
                                 </div>
                                 <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                                    <ChevronRight className="w-5 h-5" />
                                 </div>
                              </button>
                           ))}
                        </div>
                     )}
                  </div>

                  {session && albums.length > 0 && (
                     <div className="p-8 border-t border-border bg-secondary/5 text-center">
                        <div className="flex items-center justify-center gap-3 mb-2">
                           <div className="h-px w-6 bg-border" />
                           <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em]">Archive Guidelines</p>
                           <div className="h-px w-6 bg-border" />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
                           Select an album to share your captured moments. All contributions are <span className="text-foreground font-semibold">moderated</span> by the community team before being published.
                        </p>
                     </div>
                  )}
               </motion.div>
            </div>
         )}
      </AnimatePresence>
   );
}
