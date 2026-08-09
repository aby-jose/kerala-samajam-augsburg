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
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContactCaptcha, submitContactForm } from "@/lib/contact-actions";
import {
  Accent,
  Eyebrow,
  PageHeader,
} from "@/components/layout/section-heading";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  captchaCode: z.string().min(6, "Security code is required"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [captcha, setCaptcha] = React.useState<{ id: string; code: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      captchaCode: "",
    }
  });

  const captchaInput = watch("captchaCode");

  const fetchCaptcha = React.useCallback(async () => {
    const data = await getContactCaptcha();
    setCaptcha(data);
    setValue("captchaCode", "");
  }, [setValue]);

  React.useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  const onSubmit = async (data: ContactFormValues) => {
    if (!captcha) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await submitContactForm({
        ...data,
        captchaId: captcha.id,
      });

      if (result.error) {
        setError(result.error);
        fetchCaptcha();
      } else {
        setIsSent(true);
        reset();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      fetchCaptcha();
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
      
      {/* 1. Page header — surface 1 */}
      <section className="pt-40 pb-20 bg-surface-1 overflow-hidden">
        <Container className="max-w-7xl">
           <motion.div
             initial="hidden"
             animate="visible"
             variants={revealVariants}
           >
              <PageHeader
                eyebrow="Contact"
                title={<>Get in <Accent>Touch</Accent></>}
                lead="Questions about membership, an event, or moving to Augsburg? Write to us and a member of the committee will get back to you."
              />
           </motion.div>
        </Container>
      </section>

      {/* 2. Contact hub — surface 2 */}
      <section className="py-24 md:py-32 bg-surface-2 border-y border-border">
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
                  <Eyebrow>Reach us</Eyebrow>
                  <h2 className="font-sans text-2xl font-extrabold tracking-[-0.03em] text-foreground">
                    How to Reach Us
                  </h2>
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
                 <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                   Registered association
                 </span>
                 <p className="mt-3 font-sans text-sm font-bold tracking-[-0.015em] text-foreground">
                   Kerala Samajam Augsburg e.V.
                 </p>
                 <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                   Run by volunteers. Every message is read by a member of the
                   committee.
                 </p>
              </div>
            </div>

            {/* Main Content: Unified Form (Standardized Inputs) */}
            <div className="lg:col-span-8 p-8 md:p-12 relative flex flex-col justify-center">
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
                         <h3 className="font-sans text-3xl font-extrabold tracking-[-0.035em] text-foreground">Send a Message</h3>
                         <p className="text-sm text-muted-foreground">We read everything that comes in and reply as soon as we can.</p>
                      </div>

                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold p-4 rounded-xl text-center uppercase tracking-widest flex items-center justify-center gap-2"
                          >
                            <AlertCircle className="w-3 h-3" /> {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

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

                      {/* Captcha Section */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Security Verification</label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-12 bg-muted/30 border border-border rounded-lg flex items-center justify-center relative overflow-hidden group/cap">
                             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.05),transparent)]" />
                             <span className="text-xl font-black tracking-[0.3em] font-mono italic select-none opacity-80 group-hover/cap:scale-110 transition-transform">
                               {captcha?.code || "......"}
                             </span>
                             <button 
                               type="button"
                               onClick={fetchCaptcha}
                               className="absolute right-2 p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                             >
                               <RefreshCw className="h-4 w-4" />
                             </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Code"
                            maxLength={6}
                            {...register("captchaCode")}
                            className={`w-28 h-12 bg-transparent border ${errors.captchaCode ? 'border-destructive' : 'border-border'} hover:border-foreground/30 focus:border-foreground rounded-lg text-center font-bold tracking-widest text-sm transition-colors outline-none placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal uppercase`}
                          />
                        </div>
                        {errors.captchaCode && (
                          <p className="text-[10px] text-destructive flex items-center gap-1 pl-1">
                            <AlertCircle className="w-3 h-3" /> {errors.captchaCode.message}
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
                        <h3 className="font-sans text-2xl font-extrabold tracking-[-0.03em] text-foreground">Message Sent</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                           Thank you — your message is with the committee and
                           someone will be in touch.
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => setIsSent(false)} className="h-10 px-8 rounded-lg border-border hover:bg-background uppercase tracking-[0.2em] text-[10px] font-bold">
                        Send Another
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
