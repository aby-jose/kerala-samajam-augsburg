"use client";

import React, { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Loader2, 
  CheckCircle2, 
  Users, 
  Mail, 
  Phone, 
  User,
  ArrowRight,
  RefreshCcw, 
  ShieldCheck, 
  AlertCircle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { registerForEvent, getCaptcha, getUserRegistrationStatus, cancelRegistration } from "@/lib/event-actions";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { LoginModal } from "@/components/auth/login-modal";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

const registrationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone number is required"),
  attendees: z.number().min(1, "At least 1 attendee").max(10, "Max 10 per registration"),
  captchaCode: z.string().min(1, "Captcha is required"),
});

type FormValues = z.infer<typeof registrationSchema>;

interface RegistrationFormProps {
  eventId: string;
  eventTitle: string;
  requiresLogin?: boolean;
  memberPrice?: number | null;
  nonMemberPrice?: number | null;
  isMember?: boolean;
}

export function RegistrationForm({ 
  eventId, 
  eventTitle, 
  requiresLogin,
  memberPrice,
  nonMemberPrice,
  isMember
}: RegistrationFormProps) {
  const confirm = useConfirm();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"STRIPE" | "CASH">("STRIPE");
  
  const [captcha, setCaptcha] = useState<{ id: string; code: string } | null>(null);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);

  // New state for existing registration
  const [isRegistered, setIsRegistered] = useState(false);
  const [userRegistration, setUserRegistration] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      attendees: 1,
      captchaCode: "",
    },
  });

  const attendees = watch("attendees");
  const currentPricePerPerson = isMember ? (memberPrice ?? 0) : (nonMemberPrice ?? 0);
  const totalPrice = currentPricePerPerson * (attendees || 1);

  const checkStatus = async () => {
    if (!session?.user?.email) return;
    setIsCheckingStatus(true);
    try {
      const { isRegistered, registration } = await getUserRegistrationStatus(eventId);
      setIsRegistered(isRegistered);
      setUserRegistration(registration);
    } catch (err) {
      console.error("Failed to check registration status", err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  React.useEffect(() => {
    refreshCaptcha();
    if (session) checkStatus();
  }, [session, eventId]);

  const refreshCaptcha = async () => {
    setIsLoadingCaptcha(true);
    try {
      const data = await getCaptcha();
      setCaptcha(data);
    } catch (err) {
      console.error("Failed to load captcha", err);
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  React.useEffect(() => {
    if (session?.user) {
      setValue("name", session.user.name || "");
      setValue("email", session.user.email || "");
      setError(null);
    }
  }, [session, setValue]);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    if (requiresLogin && !session) {
      setIsLoginModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await registerForEvent({
        ...data,
        eventId,
        captchaId: captcha?.id || "",
        paymentMethod
      });
      
      if (result.success) {
        if (result.method === "STRIPE" && result.url) {
          window.location.href = result.url;
          return;
        }
        setTicketId(result.ticketId ?? "");
        setIsSuccess(true);
        checkStatus(); // Refresh status after success
      }
    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
      refreshCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!userRegistration?.id) return;
    
    const isConfirmed = await confirm({
      title: "Cancel Registration",
      message: "Are you sure you want to cancel your registration? This action cannot be undone.",
      confirmText: "Cancel",
      variant: "danger"
    });

    if (!isConfirmed) return;

    setIsCancelling(true);
    setError(null);
    try {
      const result = await cancelRegistration(userRegistration.id);
      if (result.success) {
        setIsRegistered(false);
        setUserRegistration(null);
        setIsSuccess(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel registration.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Checking Status...</p>
      </div>
    );
  }

  if (isRegistered && userRegistration) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* Compact Status Header */}
        <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
           <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-4 h-4" />
           </div>
           <div className="space-y-0.5">
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Successfully Registered</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">Your spot is confirmed</p>
           </div>
        </div>

        {/* Compact Info Grid */}
        <div className="grid grid-cols-2 gap-px bg-border/40 border border-border/40 rounded-xl overflow-hidden shadow-sm">
           <div className="bg-card p-4 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Ticket ID</p>
              <p className="text-sm font-mono font-bold tracking-tight text-foreground">{userRegistration.ticketId}</p>
           </div>
           <div className="bg-card p-4 space-y-1 border-l border-border/40">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Guests</p>
              <p className="text-sm font-bold text-foreground">{userRegistration.attendees} Person(s)</p>
           </div>
           <div className="bg-card p-4 space-y-1 border-t border-border/40">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Registered On</p>
              <p className="text-sm font-bold text-foreground">{new Date(userRegistration.createdAt).toLocaleDateString()}</p>
           </div>
           <div className="bg-card p-4 space-y-1 border-t border-border/40 border-l border-border/40">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">Entry Status</p>
              <p className="text-sm font-bold text-primary flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                 Ready
              </p>
           </div>
        </div>

        {/* Professional Actions */}
        <div className="space-y-2.5">
           <Button 
             onClick={() => window.open(`/api/tickets/${userRegistration.ticketId}`, '_blank')}
             className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-all"
           >
              <FileText className="w-3.5 h-3.5 mr-2" />
              Download Ticket (PDF)
           </Button>
           <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex-1 h-9 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive border-border/60 hover:bg-destructive/5 rounded-lg transition-colors"
              >
                {isCancelling ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <AlertCircle className="w-3 h-3 mr-2" />}
                Cancel
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 h-9 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-border/60 hover:bg-secondary rounded-lg transition-colors"
              >
                Contact Organizers
              </Button>
           </div>
        </div>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center space-y-3">
           <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
           </div>
           <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Registration Confirmed</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">A confirmation email has been sent to your inbox.</p>
           </div>
        </div>
        
        <div className="bg-secondary/20 border border-border/40 rounded-xl p-4 space-y-3">
           <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Reference ID</span>
              <span className="text-sm font-mono font-bold tracking-tight text-foreground">{ticketId}</span>
           </div>
           <div className="flex justify-between items-center pt-3 border-t border-border/40">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Status</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Active</span>
           </div>
        </div>

        <div className="space-y-2">
           <Button 
             onClick={() => window.open(`/api/tickets/${ticketId}`, '_blank')}
             className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-all"
           >
              <FileText className="w-3.5 h-3.5 mr-2" />
              Download Ticket (PDF)
           </Button>
           <Button 
             variant="ghost" 
             className="w-full h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
           >
              Add to Wallet / Calendar
           </Button>
           <Button 
             variant="ghost" 
             onClick={() => setIsSuccess(false)}
             className="w-full h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
           >
             Return to Event
           </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Register Attendance</h3>
            {isMember && (
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors text-[8px] h-5 px-2 uppercase tracking-widest font-black">
                Member Price Applied
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-light">Secure your spot for this community gathering.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-destructive/5 border border-destructive/20 text-destructive text-[11px] font-semibold p-3.5 rounded-lg flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Name</Label>
            <Input 
              {...register("name")} 
              placeholder="Your full name"
              readOnly={!!session}
              className="h-10 bg-secondary/20 border-border/60 focus:border-primary/40 focus:ring-0 rounded-lg text-sm transition-colors"
            />
            {errors.name && <p className="text-[10px] text-destructive font-medium pl-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Email Address</Label>
            <Input 
              {...register("email")} 
              type="email" 
              placeholder="email@example.com"
              readOnly={!!session}
              className="h-10 bg-secondary/20 border-border/60 focus:border-primary/40 focus:ring-0 rounded-lg text-sm transition-colors"
            />
            {errors.email && <p className="text-[10px] text-destructive font-medium pl-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Phone</Label>
              <Input 
                {...register("phone")} 
                placeholder="+49..."
                className="h-10 bg-secondary/20 border-border/60 focus:border-primary/40 focus:ring-0 rounded-lg text-sm transition-colors"
              />
              {errors.phone && <p className="text-[10px] text-destructive font-medium pl-1">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Guests</Label>
              <Input 
                {...register("attendees", { valueAsNumber: true })} 
                type="number" 
                min="1"
                className="h-10 bg-secondary/20 border-border/60 focus:border-primary/40 focus:ring-0 rounded-lg text-sm transition-colors"
              />
              {errors.attendees && <p className="text-[10px] text-destructive font-medium pl-1">{errors.attendees.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Security Code</Label>
            <div className="flex gap-2">
              <div className="flex-1 bg-secondary/40 border border-border/60 rounded-lg flex items-center justify-center font-mono font-bold tracking-[0.4em] text-sm select-none h-10">
                {isLoadingCaptcha ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/40" /> : captcha?.code}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={refreshCaptcha}
                disabled={isLoadingCaptcha}
                className="h-10 w-10 p-0 border-border/60 hover:bg-secondary transition-colors"
              >
                <RefreshCcw className={cn("w-3.5 h-3.5 text-muted-foreground", isLoadingCaptcha && "animate-spin")} />
              </Button>
              <Input 
                {...register("captchaCode")}
                placeholder="Code"
                className="h-10 w-24 bg-secondary/20 border-border/60 focus:border-primary/40 focus:ring-0 rounded-lg text-sm transition-colors uppercase text-center font-bold tracking-widest"
              />
            </div>
            {errors.captchaCode && <p className="text-[10px] text-destructive font-medium pl-1">{errors.captchaCode.message}</p>}
          </div>
        </div>

        {totalPrice > 0 && (
          <div className="space-y-4">
             <div className="space-y-1.5 pt-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 pl-1">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                   <Button 
                     type="button" 
                     variant="outline" 
                     onClick={() => setPaymentMethod("STRIPE")}
                     className={cn("h-10 text-[10px] font-bold uppercase tracking-widest rounded-lg", paymentMethod === "STRIPE" ? "border-primary bg-primary/5 text-primary" : "border-border/60")}
                   >
                      Online
                   </Button>
                   <Button 
                     type="button" 
                     variant="outline" 
                     onClick={() => setPaymentMethod("CASH")}
                     className={cn("h-10 text-[10px] font-bold uppercase tracking-widest rounded-lg", paymentMethod === "CASH" ? "border-primary bg-primary/5 text-primary" : "border-border/60")}
                   >
                      Cash
                   </Button>
                </div>
             </div>

             <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Fee per Person</span>
                  <span className="text-sm font-bold text-foreground">€{currentPricePerPerson.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Total to Pay</span>
                  <span className="text-lg font-black text-primary">€{totalPrice.toFixed(2)}</span>
                </div>
                <p className="text-[9px] text-muted-foreground font-medium italic pt-1 text-center">
                  {paymentMethod === "STRIPE" ? "* Instant activation via secure Stripe gateway." : "* Please bring exact change to the event."}
                </p>
             </div>
          </div>
        )}

        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-[10px] uppercase tracking-widest rounded-lg shadow-sm transition-all"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {requiresLogin && !session ? "Sign in to Register" : "Submit Registration"}
              <ArrowRight className="ml-2 w-3.5 h-3.5" />
            </>
          )}
        </Button>

        <p className="text-[9px] text-center text-muted-foreground/60 font-medium leading-relaxed max-w-[240px] mx-auto">
          {requiresLogin 
            ? "Access is limited to Kerala Samajam members." 
            : "Registration data is handled according to our privacy policy."}
        </p>
      </form>
      </div>

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </>
  );
}
