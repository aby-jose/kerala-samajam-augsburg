"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { motion, Variants } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  ArrowRight,
  Calendar,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import ContributionHubModal from "@/components/gallery/contribution-hub-modal";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";

export default function GalleryLandingClient({ initialAlbums }: { initialAlbums: any[] }) {
  const [activeCategory, setActiveCategory] = React.useState("All");
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isContributionModalOpen, setIsContributionModalOpen] = React.useState(false);

  const filteredAlbums = activeCategory === "All" 
    ? initialAlbums 
    : initialAlbums.filter(a => a.category === activeCategory);

  const categories = ["All", "Events", "Community", "Culture"];

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
    <>
      {/* 1. Page header — surface 1 */}
      <section className="pt-40 pb-20 bg-surface-1 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="text-center space-y-8"
           >
              <PageHeader
                eyebrow="Gallery"
                title={<>Photo <Accent>Gallery</Accent></>}
                lead="Every sadhya, every stage and every picnic since 2012, sorted by album. Search by face to find the photos you are in."
              />

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

      {/* 2. Album Grid — surface 2 */}
      <section id="albums-grid" className="py-24 md:py-32 bg-surface-2 border-y border-border">
        <Container className="max-w-7xl">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filteredAlbums.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-secondary/10 rounded-4xl border border-dashed border-border/40">
                <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                  <ImageIcon className="w-12 h-12" />
                  <p className="font-bold text-sm uppercase tracking-widest text-foreground">The archive is currently empty.</p>
                  <p className="text-xs text-muted-foreground font-medium">New moments are being captured as we speak.</p>
                </div>
              </div>
            ) : initialAlbums.map((album) => (
              <motion.div
                key={album.id}
                variants={revealVariants}
                className="group relative"
              >
                <Link href={`/gallery/${album.id}`}>
                  <div className="relative aspect-[16/10] rounded-[2.5rem] overflow-hidden bg-muted border border-border/10 shadow-sm transition-[transform,opacity,box-shadow] duration-500 hover:shadow-2xl hover:-translate-y-2 group/card">
                    {album.coverImage ? (
                      <img 
                        src={album.coverImage} 
                        alt={album.title}
                        className="w-full h-full object-cover transition-transform duration-2000 group-hover/card:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                        <ImageIcon className="w-16 h-16" />
                      </div>
                    )}
                    
                    {/* Glass Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover/card:opacity-100 transition-opacity duration-700" />
                    
                    <div className="absolute inset-0 p-8 flex flex-col justify-end gap-3 translate-y-4 group-hover/card:translate-y-0 transition-transform duration-700">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary/90 text-[9px] font-bold uppercase tracking-[0.2em] border-none px-3 py-1 rounded-sm shadow-sm">
                          {album._count.media} {album._count.media === 1 ? "Moment" : "Moments"}
                        </Badge>
                        {album.event && (
                          <Badge className="bg-white/10 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-[0.2em] border-white/10 px-3 py-1 rounded-sm">
                            Event
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-serif font-medium text-3xl leading-[1.1] tracking-tight">{album.title}</h4>
                        <p className="text-white/60 text-[10px] font-medium uppercase tracking-[0.15em] flex items-center gap-2">
                          <span className="h-px w-3 bg-white/30" />
                          {album.event?.title || "Community Collection"}
                        </p>
                      </div>
                    </div>

                    <div className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white opacity-0 group-hover/card:opacity-100 transition-all duration-500 hover:bg-primary hover:border-primary">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* 3. Contribution Hub — surface 1 */}
      <section className="py-24 md:py-32 bg-surface-1">
        <Container className="max-w-7xl">
          <motion.div 
            className="relative rounded-[3rem] overflow-hidden bg-secondary/30 p-12 md:p-20 shadow-sm flex flex-col md:flex-row items-center justify-between gap-12 group border border-border/50 text-center md:text-left"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(var(--primary-rgb),0.05),transparent_60%)] opacity-30 group-hover:opacity-50 transition-opacity duration-1000" />
            
            <div className="relative z-10 max-w-2xl space-y-8">
               <div className="flex justify-center md:justify-start">
                  <Eyebrow>Contribute</Eyebrow>
               </div>

               <div className="space-y-4">
                  <SectionTitle>
                    Share Your <Accent>Photos</Accent>
                  </SectionTitle>
                  <SectionLead className="mx-auto max-w-lg md:mx-0">
                    Took pictures at one of our events? Send them in and they
                    will join the album, credited to you, once a moderator has
                    had a look.
                  </SectionLead>
               </div>
            </div>

            <div className="relative z-10 shrink-0">
              <Button 
                size="lg" 
                onClick={() => {
                   if (!session) {
                      router.push(`${pathname}?auth=login`);
                   } else {
                      setIsContributionModalOpen(true);
                   }
                }}
                className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center gap-3 active:scale-[0.98]"
              >
                <Camera className="w-4 h-4" />
                Upload Photos
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </motion.div>
        </Container>
      </section>
      
      <ContributionHubModal 
        isOpen={isContributionModalOpen} 
        onClose={() => setIsContributionModalOpen(false)} 
      />
    </>
  );
}
