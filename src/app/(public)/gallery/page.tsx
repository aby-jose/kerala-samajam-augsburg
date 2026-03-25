"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  ArrowRight,
  Maximize2,
  X,
  Calendar,
  User,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Photo Dataset with Generated Assets
const ksaMemories = [
  { 
    id: 1, 
    url: "/images/gallery/onam_pookalam.png", 
    category: "Events", 
    title: "Vibrant Onam Pookalam", 
    eventName: "Onam Celebrations 2024", 
    shotBy: "Aby Joseph", 
    aspect: "aspect-[4/3]" 
  },
  { 
    id: 2, 
    url: "/images/gallery/vishu_kani.png", 
    category: "Events", 
    title: "Traditional Vishu Kani", 
    eventName: "Vishu Sammelanam", 
    shotBy: "KSA Media", 
    aspect: "aspect-square" 
  },
  { 
    id: 3, 
    url: "/images/gallery/mohiniyattam_dance.png", 
    category: "Culture", 
    title: "Mohiniyattam Grace", 
    eventName: "Cultural Workshop", 
    shotBy: "Mathews P.", 
    aspect: "aspect-[4/5]" 
  },
  { 
    id: 4, 
    url: "/images/gallery/community_picnic.png", 
    category: "Community", 
    title: "Summer Gathering", 
    eventName: "Annual Picnic", 
    shotBy: "Aby Joseph", 
    aspect: "aspect-video" 
  },
  { 
    id: 5, 
    url: "/images/gallery/kerala_sadya.png", 
    category: "Culture", 
    title: "Grand Kerala Sadya", 
    eventName: "Onam Feast", 
    shotBy: "KSA Media", 
    aspect: "aspect-[4/3]" 
  },
  { 
    id: 6, 
    url: "/images/gallery/vallam_kali.png", 
    category: "Events", 
    title: "The Snake Boat Race", 
    eventName: "Uthrittathi Vallam Kali", 
    shotBy: "Aby Joseph", 
    aspect: "aspect-video" 
  },
  { 
    id: 7, 
    url: "/images/gallery/cultural_workshop.png", 
    category: "Culture", 
    title: "Crafting Traditions", 
    eventName: "Youth Workshop", 
    shotBy: "Mathews P.", 
    aspect: "aspect-square" 
  },
  { 
    id: 8, 
    url: "/images/gallery/kathakali_performer.png", 
    category: "Culture", 
    title: "Kathakali Expression", 
    eventName: "Cultural Night", 
    shotBy: "KSA Media", 
    aspect: "aspect-[3/4]" 
  },
  { 
    id: 9, 
    url: "/images/gallery/thiruvathira_dance.png", 
    category: "Culture", 
    title: "Thiruvathira Circle", 
    eventName: "Femina Night", 
    shotBy: "Aby Joseph", 
    aspect: "aspect-video" 
  },
];

const categories = ["All", "Events", "Community", "Culture"];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = React.useState("All");
  const [selectedPhoto, setSelectedPhoto] = React.useState<typeof ksaMemories[0] | null>(null);

  const filteredPhotos = activeCategory === "All" 
    ? ksaMemories 
    : ksaMemories.filter(p => p.category === activeCategory);

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } 
    },
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.1 } 
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      
      {/* 1. Grand Centered Editorial Header (7xl) */}
      <section className="pt-40 pb-20 border-b border-border/5 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="text-center space-y-8"
           >
              <div className="space-y-6 max-w-4xl mx-auto">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.5em] block">Our Visual Journey</span>
                <h1 className="text-4xl md:text-6xl font-serif font-medium leading-[1.05] tracking-tight text-foreground">
                  The <span className="text-primary italic">KSA</span> Collection.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed font-light max-w-2xl mx-auto pt-4 transition-colors duration-500">
                  Preserving cultural milestones through the lens of our community. Explore the vibrant spirit of Kerala in Augsburg.
                </p>
              </div>

              {/* Filter Navigation */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-8">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "group flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 border h-10 active:scale-[0.98]",
                      activeCategory === cat
                        ? "bg-primary text-white border-transparent shadow-sm"
                        : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground hover:border-border"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
           </motion.div>
        </Container>
      </section>

      {/* 2. Masonry Gallery Grid (7xl) */}
      <section className="py-24 bg-background transition-colors duration-500">
        <Container className="max-w-7xl">
          <motion.div 
            layout
            className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo) => (
                <motion.div
                  key={photo.id}
                  layout
                  variants={revealVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="break-inside-avoid relative"
                >
                  <div 
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative rounded-3xl overflow-hidden bg-muted border border-border/10 shadow-xs transition-all duration-700 hover:shadow-2xl hover:-translate-y-1 cursor-zoom-in"
                  >
                    <div className={cn("relative w-full", photo.aspect)}>
                      <img 
                        src={photo.url} 
                        alt={photo.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-2000 group-hover:scale-110"
                      />
                      
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 p-8 flex flex-col justify-end gap-3 translate-y-4 group-hover:translate-y-0">
                        <Badge className="w-fit bg-primary/90 text-[9px] font-bold uppercase tracking-[0.2em] border-none px-3 py-1 rounded-sm shadow-sm">
                          {photo.category}
                        </Badge>
                        <div className="space-y-1">
                          <h4 className="text-white font-serif font-medium text-2xl leading-[1.1] tracking-tight">{photo.title}</h4>
                          <p className="text-white/60 text-[10px] font-medium uppercase tracking-[0.15em] flex items-center gap-2">
                            <span className="h-px w-3 bg-white/30" />
                            {photo.eventName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </Container>
      </section>

      {/* 3. Contribution Hub card (EventsCTA Style) */}
      <section className="py-24 bg-background pb-32">
        <Container className="max-w-7xl">
          <motion.div 
            className="relative rounded-4xl overflow-hidden bg-secondary/30 p-12 md:p-20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-12 group border border-border/50 text-center md:text-left"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary-rgb),0.05),transparent_60%)] opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
            
            <div className="relative z-10 max-w-2xl space-y-8">
               <div className="flex items-center gap-3 justify-center md:justify-start">
                  <div className="h-px w-8 bg-primary/40" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.5em]">Media Collective</span>
               </div>
               
               <div className="space-y-4">
                  <h2 className="text-4xl md:text-5xl font-serif font-medium text-foreground leading-[1.1] tracking-tight">
                    Share your <span className="text-primary italic">Perspective.</span>
                  </h2>
                  <p className="text-muted-foreground leading-relaxed font-light text-lg max-w-lg mx-auto md:mx-0">
                    Join our media collective. If you have captured moments from our events, we&apos;d love to feature them in the archive.
                  </p>
               </div>
            </div>

            <div className="relative z-10 shrink-0">
              <Button size="lg" className="h-14 px-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 active:scale-[0.98]">
                <Camera className="w-4 h-4" />
                Contribution Hub
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* 4. Interactive Theme-Responsive Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl p-4 md:p-12 flex items-center justify-center cursor-zoom-out"
            onClick={() => setSelectedPhoto(null)}
          >
            <button 
               className="absolute top-8 right-8 h-12 w-12 rounded-full bg-muted/50 hover:bg-muted text-foreground flex items-center justify-center transition-all z-50 border border-border"
               onClick={(e) => { e.stopPropagation(); setSelectedPhoto(null); }}
            >
               <X className="h-5 w-5" />
            </button>

            <motion.div
              layoutId={`modal-${selectedPhoto.id}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-6xl w-full h-full flex flex-col md:flex-row items-center gap-12"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="flex-1 h-full flex items-center justify-center">
                  <img 
                    src={selectedPhoto.url} 
                    alt={selectedPhoto.title}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                  />
               </div>

               <div className="md:w-80 w-full shrink-0 flex flex-col gap-8 justify-center h-full text-center md:text-left text-foreground">
                  <div className="space-y-2">
                     <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em] block">{selectedPhoto.category}</span>
                     <h3 className="text-4xl font-serif font-medium leading-tight">{selectedPhoto.title}</h3>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-border">
                     <div className="flex items-start gap-4 justify-center md:justify-start">
                        <Calendar className="h-5 w-5 text-primary shrink-0" />
                        <div>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Occasion</span>
                           <p className="text-base font-light">{selectedPhoto.eventName}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-4 justify-center md:justify-start">
                        <User className="h-5 w-5 text-primary shrink-0" />
                        <div>
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Shot By</span>
                           <p className="text-base font-light">{selectedPhoto.shotBy}</p>
                        </div>
                     </div>
                  </div>

                  <div className="pt-8">
                     <Link href="/membership" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" className="w-full h-12 rounded-lg border-border text-foreground hover:bg-muted uppercase tracking-[0.2em] text-[10px] font-bold">
                           Join Media Collective
                        </Button>
                     </Link>
                  </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
