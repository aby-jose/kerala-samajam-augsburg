"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  Share2,
  Ticket,
  Loader2,
  ExternalLink,
  Map,
  Check,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { getEventBySlug } from "@/lib/event-actions";
import { RegistrationForm } from "@/components/events/registration-form";
import { checkCurrentMemberStatus } from "@/lib/membership-actions";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";

export default function EventDetailPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [memberStatus, setMemberStatus] = useState<Awaited<ReturnType<typeof checkCurrentMemberStatus>>>({ isMember: false });
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const [eventData, status] = await Promise.all([
          getEventBySlug(slug as string),
          checkCurrentMemberStatus()
        ]);
        
        if (!eventData) {
          router.push("/events");
          return;
        }
        setEvent(eventData);
        setMemberStatus(status);
      } catch (error) {
        console.error("Failed to load event data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEventData();
  }, [slug, router, session]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!event) return null;

  return (
    <main className="min-h-screen bg-background pt-32 pb-24">
      <Container>
        
        {/* Unified Page Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-20">
          
          {/* Content Area (Left) */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Header Section */}
            <div className="space-y-8">
              <nav className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Link href="/events" className="hover:text-primary transition-colors">Calendar</Link>
                <ChevronRight className="w-3 h-3 text-border" />
                <span className="text-primary/60">{event.category || 'Cultural'}</span>
              </nav>

              <div className="space-y-4">
                 <h1 className="text-4xl md:text-6xl font-sans font-bold tracking-tight text-foreground leading-[1.1]">
                   {event.title}
                 </h1>
                 <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
                    <MetaItem icon={Calendar} label="Date" value={new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} />
                    <MetaItem icon={Clock} label="Time" value={`${event.startTime || '10:00'} — ${event.endTime || '17:00'}`} />
                 </div>
              </div>
            </div>

            {/* Overview / Description */}
            <div className="space-y-10">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                 <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40 mb-6">Overview</h2>
                 <p className="text-lg leading-relaxed text-muted-foreground/90 font-light">
                   {event.description}
                 </p>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                 <div className="p-6 bg-secondary/20 rounded-xl border border-border/40 space-y-4">
                    <MapPin className="w-5 h-5 text-primary/60" />
                    <div className="space-y-1">
                       <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Location</p>
                       <p className="text-sm font-semibold">{event.location}</p>
                       <p className="text-xs text-muted-foreground font-light">{event.address || 'Augsburg, Germany'}</p>
                    </div>
                    <Button variant="link" className="p-0 h-auto text-[10px] font-bold uppercase tracking-widest">
                      View on Map
                    </Button>
                 </div>
                  <div className="p-6 bg-secondary/20 rounded-xl border border-border/40 space-y-4">
                    <Ticket className="w-5 h-5 text-primary/60" />
                    <div className="space-y-1">
                       <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Admission</p>
                       <div className="space-y-1">
                          {event.memberPrice !== null || event.nonMemberPrice !== null ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className={cn("text-sm", memberStatus.isMember ? "font-bold text-primary" : "font-medium text-muted-foreground")}>
                                  Members: {event.memberPrice === 0 ? 'Free' : `€${event.memberPrice}`}
                                </span>
                                {memberStatus.isMember && <Badge className="text-[8px] h-4 bg-primary/10 text-primary border-primary/20">Active Plan</Badge>}
                              </div>
                              <div className={cn("text-sm", !memberStatus.isMember ? "font-bold" : "font-medium text-muted-foreground")}>
                                Others: €{event.nonMemberPrice ?? event.price ?? 0}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm font-semibold">{event.price > 0 ? `${event.price} ${event.currency || 'EUR'}` : 'Free Entry'}</p>
                          )}
                       </div>
                       <p className="text-[10px] text-muted-foreground font-light pt-1">Registration required for attendance</p>
                    </div>
                  </div>
              </div>
            </div>

            {/* Event Highlights */}
            <div className="space-y-8 pt-8">
               <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">Event Highlights</h2>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    'Authentic Cultural Showcase',
                    'Traditional Kerala Delicacies',
                    'Community Networking',
                    'Family-friendly Activities'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm text-muted-foreground group">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                       {item}
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* Sidebar Area (Right) */}
          <div className="lg:col-span-4 space-y-10">
            <div className="sticky top-28 space-y-8">
              
              {/* Event Image */}
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted border border-border/50 shadow-sm">
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/10 font-black italic text-4xl">
                    KSA
                  </div>
                )}
              </div>

              {/* Registration Card */}
              <div className="bg-card border border-border p-8 rounded-2xl shadow-sm space-y-6 relative overflow-hidden">
                {!session ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="space-y-2">
                       <h3 className="text-lg font-serif font-bold">Registration required</h3>
                       <p className="text-xs text-muted-foreground leading-relaxed">
                          Please sign in to your account to register for this event. 
                          If you don't have an account, you can create one in seconds.
                       </p>
                    </div>
                    <Button 
                      onClick={() => router.push(`${pathname}?auth=login`)}
                      className="w-full h-12 rounded-xl font-bold text-xs tracking-widest shadow-lg shadow-primary/20"
                    >
                       Sign in to register
                    </Button>
                    <div className="pt-2 text-center">
                       <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                          Members get discounted pricing
                       </p>
                    </div>
                  </div>
                ) : (
                  <RegistrationForm
                    eventId={event.id}
                    eventTitle={event.title}
                    requiresLogin={event.requiresLogin}
                    memberPrice={event.memberPrice}
                    nonMemberPrice={event.nonMemberPrice}
                    isMember={memberStatus.isMember}
                  />
                )}

                <div className="pt-4 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-t border-border/50">
                  <span>Status: Open</span>
                  <span>{event._count?.registrations || 0} Registered</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between px-2">
                 <button className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                    <Share2 className="w-3 h-3" /> Share
                 </button>
                 <Link href="/contact" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
                    Report Issue
                 </Link>
              </div>
            </div>
          </div>

        </div>
      </Container>
    </main>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-primary/60 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
         <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{label}</p>
         <p className="text-sm font-semibold text-foreground tracking-tight">{value}</p>
      </div>
    </div>
  );
}
