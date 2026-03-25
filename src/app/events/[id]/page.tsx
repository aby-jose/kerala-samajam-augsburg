"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Share2, 
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  Ticket,
  MapIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Check
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

// Shared events data for consistency
const allEvents = [
  {
    id: "1",
    title: "Grand Onam Celebration 2026",
    date: "2026-08-30T10:00:00",
    startTime: "10:00 AM",
    endTime: "05:00 PM",
    location: "Augsburg Community Hall",
    address: "Maximilianstraße 12, 86150 Augsburg, Germany",
    description: "Experience the vibrant spirit of Kerala with traditional Pookalam, grand Onasadhya, and cultural performances that bring our heritage to life. \n\nHighlights include:\n- Floral Carpet (Pookalam) competition\n- Authentic 26-item Onasadhya\n- Pulikkali and Kathakali performances\n- Tug of war and traditional games",
    image: "/images/events/onam-celebration.png",
    category: "Cultural Festival",
    price: "€15 Members / €25 Guests",
    featured: true
  },
  {
    id: "2",
    title: "Kerala Traditional Music Night",
    date: "2026-05-15T18:00:00",
    startTime: "06:00 PM",
    endTime: "10:00 PM",
    location: "Kulturhaus Abraxas",
    address: "Sommestraße 30, 86156 Augsburg, Germany",
    description: "An evening of soul-stirring rhythms featuring traditional instruments like Chenda and Mridangam.\n\nFeaturing:\n- Sopana Sangeetham\n- Percussion Ensemble (Thayambaka)\n- Fusion of East and West",
    image: "/images/events/music-night.png",
    category: "Music & Arts",
    price: "€10 Entry",
    featured: true
  },
  {
    id: "3",
    title: "Traditional Arts Workshop",
    date: "2026-06-20T14:00:00",
    startTime: "02:00 PM",
    endTime: "06:00 PM",
    location: "KSA Cultural Center",
    address: "Berliner Allee 20, 86153 Augsburg, Germany",
    description: "A hands-on workshop dedicated to preserving Kerala's unique arts. Learn the techniques of Kathakali mask making and traditional mural painting.",
    image: "/images/events/traditional-workshop.png",
    category: "Education",
    price: "Free",
    featured: true
  },
  {
    id: "4",
    title: "Summer Community Gathering",
    date: "2026-07-12T11:00:00",
    startTime: "11:00 AM",
    endTime: "04:00 PM",
    location: "Augsburg City Park",
    address: "Prinzenstraße 10, 86150 Augsburg, Germany",
    description: "Join your KSA family for a day of fun, food, and friendship. A perfect opportunity for the community to connect and celebrate together.",
    image: "/images/events/Summer.jpg",
    category: "Social",
    price: "Potluck Based",
    featured: false
  },
];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const event = allEvents.find(e => e.id === eventId) || allEvents[0];
  const [isModalOpen, setIsModalOpen] = useState(false);

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.4, ease: "easeOut" } 
    },
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      
      {/* 1. Integrated Narrative Header (7xl) */}
      <section className="pt-28 pb-10 bg-background">
        <Container className="max-w-7xl">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={revealVariants}
            className="space-y-6"
          >
            <nav className="flex">
              <Link 
                href="/events" 
                className="inline-flex items-center text-muted-foreground font-bold uppercase tracking-widest text-[10px] hover:text-primary transition-colors group"
              >
                <ChevronLeft className="mr-1.5 h-4 w-4 transform group-hover:-translate-x-1 transition-transform" />
                Go Back
              </Link>
            </nav>

            <h1 className="text-2xl md:text-4xl lg:text-4xl font-serif font-medium leading-tight tracking-tight text-foreground max-w-4xl">
              {event.title}
            </h1>
          </motion.div>
        </Container>
      </section>

      {/* 2. Main Narrative Flow + Sidebar */}
      <section className="pb-32 bg-background border-t border-border/10 pt-10">
        <Container className="max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Primary Column: Narrative Stream */}
            <div className="lg:col-span-8 space-y-10">
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="relative aspect-video rounded-xl overflow-hidden border border-border bg-muted shadow-sm"
               >
                  <img 
                      src={event.image} 
                      alt={event.title} 
                      className="w-full h-full object-cover"
                  />
               </motion.div>

               <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none text-muted-foreground/90 font-light leading-relaxed">
                  {event.description}
               </div>

               <div className="pt-10 border-t border-border/30 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Event Date</span>
                        <div className="text-foreground font-medium text-lg leading-none">
                           {formatDate(event.date)}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Entry Time</span>
                        <div className="text-foreground font-medium text-lg leading-none">
                           {event.startTime} — {event.endTime}
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Venue Profile</span>
                     <div className="space-y-1">
                        <div className="text-foreground font-medium text-lg leading-tight">{event.location}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed italic">{event.address}</div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Sidebar Column: Sticky Action Card */}
            <div className="lg:col-span-4 sticky top-32">
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 className="p-8 rounded-2xl border border-border bg-card shadow-lg space-y-8"
               >
                  <div className="space-y-1">
                     <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">Investment</span>
                     <div className="text-2xl font-serif font-medium text-foreground">{event.price}</div>
                  </div>

                  <div className="pt-6 border-t border-border/50 space-y-5">
                     <Button 
                       onClick={() => setIsModalOpen(true)}
                       className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] transition-all hover:-translate-y-px active:scale-[0.98]"
                     >
                        Confirm Entry
                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                     </Button>

                     <div className="flex justify-center items-center gap-6 pt-2">
                        <button className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5">
                           <Share2 className="w-3 h-3" /> Share Info
                        </button>
                        <div className="h-3 w-px bg-border" />
                        <button className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1.5">
                           <Ticket className="w-3 h-3" /> Digital Pass
                        </button>
                     </div>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-start gap-4">
                     <MapIcon className="w-4 h-4 text-primary shrink-0" />
                     <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Early attendance ensures priority access to the cultural inaugural proceedings.
                     </p>
                  </div>
               </motion.div>
            </div>
          </div>
        </Container>
      </section>

      {/* Registration Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <RegisterEventModal 
            event={event} 
            onClose={() => setIsModalOpen(false)} 
          />
        )}
      </AnimatePresence>
      
    </main>
  );
}

function RegisterEventModal({ event, onClose }: { event: any, onClose: () => void }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    tickets: 1
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-serif font-medium text-foreground">Event Registration</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{event.title}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State or Form */}
        <div ref={modalBodyRef} className="flex-1 overflow-y-auto p-6 md:p-8">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 text-center space-y-6"
            >
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-medium text-foreground">Registration Complete</h3>
                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  We've received your request for {formData.tickets} ticket(s). A confirmation entry has been sent to {formData.email}.
                </p>
              </div>
              <Button 
                onClick={onClose}
                className="px-8 h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px]"
              >
                Close Window
              </Button>
            </motion.div>
          ) : (
            <form id="registration-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`w-full h-12 bg-muted/30 border ${errors.fullName ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                    placeholder="Enter your full name"
                  />
                  {errors.fullName && <p className="text-[10px] text-destructive flex items-center gap-1 pl-1"><AlertCircle className="w-3 h-3" /> {errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full h-12 bg-muted/30 border ${errors.email ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                    placeholder="name@example.com"
                  />
                  {errors.email && <p className="text-[10px] text-destructive flex items-center gap-1 pl-1"><AlertCircle className="w-3 h-3" /> {errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full h-12 bg-muted/30 border ${errors.phone ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                    placeholder="+49 123 456789"
                  />
                  {errors.phone && <p className="text-[10px] text-destructive flex items-center gap-1 pl-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Number of Tickets</label>
                  <CustomSelect 
                    value={formData.tickets} 
                    onChange={(val) => setFormData({ ...formData, tickets: val })}
                    options={[1, 2, 3, 4, 5, 10]}
                    scrollContainerRef={modalBodyRef}
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                 <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>Summary</span>
                    <span className="text-primary">{formData.tickets} × {event.price.split(' ')[0]}</span>
                 </div>
                 <p className="text-[10px] text-muted-foreground leading-relaxed">
                    By clicking complete, you agree to our community standards and attendance protocols.
                 </p>
              </div>
            </form>
          )}
        </div>

        {/* Actions - Fixed Bottom */}
        {!isSuccess && (
          <div className="p-6 md:p-8 border-t border-border bg-muted/20 flex flex-col sm:flex-row gap-4">
            <Button 
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-12 rounded-lg text-muted-foreground font-bold uppercase tracking-widest text-[10px] hover:bg-muted"
            >
              Cancel Registration
            </Button>
            <Button 
              form="registration-form"
              disabled={isSubmitting}
              type="submit"
              className="flex-2 h-12 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-[0.2em] text-[10px] transition-all relative overflow-hidden"
            >
              {isSubmitting ? (
                 <span className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                    Processing...
                 </span>
              ) : (
                "Complete Registration"
              )}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function CustomSelect({ 
  value, 
  onChange, 
  options,
  scrollContainerRef
}: { 
  value: number, 
  onChange: (val: number) => void, 
  options: number[],
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
      
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.addEventListener("scroll", updateCoords);
      }

      return () => {
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, true);
        if (scrollContainer) {
          scrollContainer.removeEventListener("scroll", updateCoords);
        }
      };
    }
  }, [isOpen, scrollContainerRef]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 bg-muted/30 border border-border rounded-lg px-4 text-sm flex items-center justify-between outline-none focus:ring-1 focus:ring-primary transition-all hover:bg-muted/40"
      >
        <span className="text-foreground">{value} Ticket{value > 1 ? 's' : ''}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal-like Floating Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: coords.top - window.scrollY + 8,
              left: coords.left - window.scrollX,
              width: coords.width,
            }}
            className="z-110 bg-card border border-border rounded-xl shadow-2xl overflow-hidden py-1.5 backdrop-blur-md"
          >
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between transition-colors
                  ${value === option ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}
                `}
              >
                <span>{option} Ticket{option > 1 ? 's' : ''}</span>
                {value === option && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
