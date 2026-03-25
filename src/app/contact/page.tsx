"use client";

import React from "react";
import { Container } from "@/components/layout/container";
import { motion, Variants, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Mail, 
  MapPin, 
  Send, 
  Loader2,
  CheckCircle2,
  Globe,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Contact form submission:", data);
      setIsSent(true);
      reset();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const revealVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } 
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5">
      
      {/* 1. Institutional Hero Header */}
      <section className="pt-40 pb-20 border-b border-border/5 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
             className="text-center space-y-8"
           >
              <div className="space-y-4 max-w-4xl mx-auto">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.5em] block">Connect with Us</span>
                <h1 className="text-4xl md:text-5xl font-serif font-medium leading-[1.05] tracking-tight text-foreground">
                  Get in <span className="text-primary italic font-light">Touch.</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed font-light max-w-2xl mx-auto transition-colors duration-500">
                  Have questions about our initiatives? We are here to help you connect with the heart of Kerala in Augsburg.
                </p>
              </div>
           </motion.div>
        </Container>
      </section>

      {/* 2. Unified Contact Hub */}
      <section className="py-24 bg-background mb-20">
        <Container className="max-w-6xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 lg:grid-cols-12 rounded-4xl bg-secondary/5 border border-border/50 shadow-xs overflow-hidden"
          >
            {/* Sidebar: Channels */}
            <div className="lg:col-span-4 bg-secondary/10 p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col justify-between">
              <div className="space-y-12">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Our Channels</h3>
                  <h2 className="text-2xl font-serif font-medium tracking-tight">Direct Path.</h2>
                </div>

                <div className="space-y-8">
                  {[
                    { icon: Mail, label: "Email", value: "info@ksaugsburg.de", href: "mailto:info@ksaugsburg.de" },
                    { icon: MessageSquare, label: "Phone", value: "+49 123 4567890", href: "tel:+491234567890" },
                    { icon: MapPin, label: "Location", value: "Augsburg, Germany", href: "#" }
                  ].map((info, idx) => (
                    <motion.a 
                      key={idx} 
                      href={info.href}
                      variants={itemVariants}
                      className="group flex items-start gap-4 transition-all"
                    >
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                        <info.icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 block">{info.label}</span>
                        <h4 className="text-base font-serif font-medium text-foreground group-hover:text-primary transition-colors">{info.value}</h4>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>

              <div className="pt-12 mt-12 border-t border-border/50 hidden lg:block">
                 <div className="flex -space-x-2 mb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-7 w-7 rounded-full border border-background bg-muted overflow-hidden flex items-center justify-center grayscale">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} alt="Collaborator" className="h-full w-full object-cover" />
                    </div>
                  ))}
                 </div>
                 <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 block">500+ Active Members</span>
              </div>
            </div>

            {/* Main Content: Unified Form (Standardized Inputs) */}
            <div className="lg:col-span-8 p-8 md:p-12 md:p-16 relative flex flex-col justify-center">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Globe className="h-12 w-12 text-primary animate-spin-slow" />
               </div>

               <AnimatePresence mode="wait">
                  {!isSent ? (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-8 relative z-10"
                    >
                      <div className="space-y-1">
                         <h3 className="text-3xl font-serif font-medium tracking-tight">Send a Message.</h3>
                         <p className="text-sm text-muted-foreground font-light">We typically respond within one business day.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Full Name</label>
                          <input 
                            {...register("name")} 
                            placeholder="Aby Joseph" 
                            className={`w-full h-12 bg-muted/30 border ${errors.name ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                          />
                          {errors.name && (
                            <p className="text-[10px] text-destructive flex items-center gap-1 pl-1">
                              <AlertCircle className="w-3 h-3" /> {errors.name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Email Address</label>
                          <input 
                            type="email" 
                            {...register("email")} 
                            placeholder="your@email.com" 
                            className={`w-full h-12 bg-muted/30 border ${errors.email ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                          />
                          {errors.email && (
                            <p className="text-[10px] text-destructive flex items-center gap-1 pl-1">
                              <AlertCircle className="w-3 h-3" /> {errors.email.message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Subject</label>
                        <input 
                          {...register("subject")} 
                          placeholder="How can we help?" 
                          className={`w-full h-12 bg-muted/30 border ${errors.subject ? 'border-destructive' : 'border-border'} rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all`}
                        />
                        {errors.subject && (
                          <p className="text-[10px] text-destructive flex items-center gap-1 pl-1">
                            <AlertCircle className="w-3 h-3" /> {errors.subject.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Your Message</label>
                        <textarea 
                          {...register("message")}
                          rows={4}
                          className={`flex min-h-[140px] w-full rounded-lg bg-muted/30 border ${errors.message ? 'border-destructive' : 'border-border'} px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground/40 focus-visible:outline-none focus:ring-1 focus:ring-primary transition-all font-light`}
                          placeholder="Compose your query..."
                        />
                        {errors.message && (
                          <p className="text-[10px] text-destructive flex items-center gap-1 pl-1">
                            <AlertCircle className="w-3 h-3" /> {errors.message.message}
                          </p>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        size="sm" 
                        className="w-full h-12 rounded-lg font-bold uppercase tracking-[0.2em] text-[10px] bg-primary hover:bg-primary/90 text-white shadow-xl transition-all group active:scale-[0.98]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            Send Message
                            <Send className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-16 text-center space-y-6"
                    >
                      <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-serif font-medium tracking-tight">Message Received.</h3>
                        <p className="text-sm text-muted-foreground font-light max-w-sm mx-auto leading-relaxed">
                           We have received your query and will respond shortly.
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setIsSent(false)} className="h-10 px-8 rounded-lg border-border hover:bg-background uppercase tracking-[0.2em] text-[10px] font-bold">
                        Return
                      </Button>
                    </motion.div>
                  )}
               </AnimatePresence>
            </div>
          </motion.div>
        </Container>
      </section>

    </main>
  );
}
