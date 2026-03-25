"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  CheckCircle2, 
  QrCode, 
  Download, 
  Loader2, 
  ChevronLeft,
  ArrowRight,
  Send
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";

const registrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  attendees: z.number().min(1, "At least 1 attendee required").max(10, "Max 10 attendees per booking"),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function RegistrationPage() {
  const { id } = useParams();
  const [step, setStep] = React.useState<"form" | "success">("form");
  const [isLoading, setIsLoading] = React.useState(false);
  const [registrationData, setRegistrationData] = React.useState<RegistrationFormValues & { ticketId: string; eventName: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      attendees: 1,
    },
  });

  const onSubmit = async (data: RegistrationFormValues) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const mockResponse = {
      ticketId: "KSA-XJ92LK",
      eventName: "Vishu Celebration 2026",
      ...data,
    };
    
    setRegistrationData(mockResponse);
    setIsLoading(false);
    setStep("success");
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
      }
    },
  };

  return (
    <main className="min-h-screen flex flex-col bg-background">
      
      {/* Header */}
      <section className="pt-48 pb-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[50%] h-full bg-primary/10 blur-[150px] rounded-full translate-x-1/2 -z-10" />
        <Container>
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/events/${id}`} className="inline-flex items-center text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-12 hover:translate-x-[-10px] transition-transform group">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Return to Milestone
              </Link>
              <span className="text-primary font-black uppercase tracking-[0.4em] text-[10px] mb-8 block">Registration Protocol</span>
              <h1 className="text-6xl md:text-9xl font-serif font-black mb-10 leading-[0.85] tracking-tight">
                Secure your <br />
                <span className="text-primary italic">Presence.</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium italic">
                A few details are required to finalize your participation in the upcoming cultural experience. 
              </p>
            </motion.div>
          </div>
        </Container>
      </section>

      <section className="py-24 pb-48">
        <Container>
          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              {step === "form" ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  transition={{ duration: 0.8 }}
                >
                  <Card className="border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[4rem] overflow-hidden bg-zinc-950/50 backdrop-blur-3xl ring-1 ring-white/5">
                    <CardHeader className="p-12 md:p-20 pb-0">
                      <CardTitle className="text-4xl font-serif font-black italic mb-4">Attendee <span className="text-primary">Intel.</span></CardTitle>
                      <CardDescription className="text-muted-foreground text-lg font-medium italic">
                        All information provided is secured in our community encryption.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-12 md:p-20">
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                        <div className="space-y-4">
                          <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-1">Full Name</Label>
                          <Input id="name" {...register("name")} placeholder="Aby Joseph" className="h-20 rounded-2xl bg-white/5 border-white/10 focus:ring-primary/20 px-8 font-medium italic text-lg" />
                          {errors.name && <p className="text-[10px] text-destructive font-black uppercase tracking-widest ml-1">{errors.name.message}</p>}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-4">
                            <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-1">Email Address</Label>
                            <Input id="email" type="email" {...register("email")} placeholder="aby@ksaugsburg.de" className="h-16 rounded-2xl bg-white/5 border-white/10 focus:ring-primary/20 px-8 font-medium italic" />
                            {errors.email && <p className="text-[10px] text-destructive font-black uppercase tracking-widest ml-1">{errors.email.message}</p>}
                          </div>
                          <div className="space-y-4">
                            <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-1">Phone (Optional)</Label>
                            <Input id="phone" {...register("phone")} placeholder="+49 123 456789" className="h-16 rounded-2xl bg-white/5 border-white/10 focus:ring-primary/20 px-8 font-medium italic" />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <Label htmlFor="attendees" className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-1">Total Attendees</Label>
                          <Input id="attendees" type="number" {...register("attendees", { valueAsNumber: true })} className="h-16 rounded-2xl bg-white/5 border-white/10 focus:ring-primary/20 px-8 font-medium italic" />
                          {errors.attendees && <p className="text-[10px] text-destructive font-black uppercase tracking-widest ml-1">{errors.attendees.message}</p>}
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-24 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm shadow-2xl mt-10 group bg-primary hover:shadow-primary/40 transition-all duration-500" 
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-10 w-10 animate-spin" />
                          ) : (
                            <>
                              Confirm Registration
                              <ArrowRight className="ml-4 h-6 w-6 group-hover:translate-x-3 transition-transform" />
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center"
                >
                  <Card className="border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] rounded-[5rem] overflow-hidden bg-zinc-950/50 backdrop-blur-3xl ring-1 ring-white/5">
                    <div className="bg-primary py-24 flex justify-center relative overflow-hidden group">
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 15, stiffness: 150 }}
                        className="relative z-10"
                      >
                        <CheckCircle2 className="h-32 w-32 text-white" />
                      </motion.div>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <CardContent className="p-20">
                      <h2 className="text-5xl md:text-6xl font-serif font-black italic mb-6">Confirmed.</h2>
                      <p className="text-muted-foreground text-xl font-medium italic mb-12 max-w-lg mx-auto leading-relaxed">
                        Transformed successfully, {registrationData?.name}. Your digital access is now etched in our archive.
                      </p>
                      
                      <div className="glass-morphism p-12 rounded-[3.5rem] mb-12 border border-white/10 flex flex-col items-center group/ticket shadow-3xl">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl mb-8 group-hover/ticket:scale-110 transition-transform duration-700">
                          <QrCode className="h-48 w-48 text-black" />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-primary font-black uppercase tracking-[0.5em] mb-4">Ticket Identifier</p>
                          <p className="text-3xl font-serif font-black italic text-foreground tracking-widest">{registrationData?.ticketId}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Button variant="outline" className="h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] border-white/10 hover:bg-white/5 transition-all" type="button">
                          <Download className="mr-3 h-4 w-4" />
                          Download Archive
                        </Button>
                        <Link href="/" className="w-full">
                          <Button className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl group/home" type="button">
                            Return to Base
                            <Send className="ml-3 h-4 w-4 group-hover/home:translate-x-2 group-hover/home:-translate-y-2 transition-transform" />
                          </Button>
                        </Link>
                      </div>
                      <p className="mt-12 text-sm text-muted-foreground font-medium italic">
                        A verification dispatch has been sent to <span className="text-primary underline">{registrationData?.email}</span>.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Container>
      </section>
    </main>
  );
}
