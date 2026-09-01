"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Shield, Award, Calendar, CreditCard, User, Users, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/components/providers/config-provider";
import { establishedLine } from "@/lib/org-identity";

interface MembershipSuccessOverlayProps {
  subscription: any;
}

export default function MembershipSuccessOverlay({ subscription }: MembershipSuccessOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const router = useRouter();
  // The sidebar is the card's letterhead — the name and the founding facts on
  // it are the association's, so they come from Settings.
  const config = useConfig();
  const established = establishedLine(config);

  const handleClose = () => {
    setIsVisible(false);
    router.replace("/profile", { scroll: false });
  };

  const details = subscription.details || {};
  const isStudent = subscription.plan.name.toLowerCase().includes("student");
  const isFamily = subscription.plan.name.toLowerCase().includes("family");

  // An application is not a membership. The overlay used to announce
  // "Transaction Verified / Membership Activated" for every row it was handed,
  // which was only ever true because a Stripe payment had already cleared
  // before the redirect landed here.
  const isActive = subscription.paymentStatus === "PAID" && !!subscription.startDate;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
          {/* Subtle backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md"
          />

          {/* Professional Dossier Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1, y: 5 }}
            className="relative w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Sidebar Branding */}
            <div className="w-full md:w-48 bg-zinc-950 p-8 flex flex-col justify-between shrink-0 text-white">
               <div className="space-y-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                     <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                     <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/40">Official Record</p>
                     <p className="text-sm font-serif italic text-white/90">{config.siteName}</p>
                  </div>
               </div>
               
               <div className="pt-12 md:pt-0">
                  <p className="text-[7px] font-bold uppercase tracking-widest text-white/30 leading-relaxed">
                     {established.year && (
                       <>
                         {established.year} <br />
                       </>
                     )}
                     {established.place}
                  </p>
               </div>
            </div>

            {/* Main Details */}
            <div className="flex-1 p-8 md:p-12 space-y-10">
               <div className="flex justify-between items-start">
                  <div className="space-y-2">
                     <div className={cn(
                       "inline-flex items-center gap-2 px-2 py-0.5 rounded-md border",
                       isActive
                         ? "bg-emerald-500/10 border-emerald-500/20"
                         : "bg-amber-500/10 border-amber-500/20"
                     )}>
                        <div className={cn(
                          "w-1 h-1 rounded-full animate-pulse",
                          isActive ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          isActive ? "text-emerald-500" : "text-amber-500"
                        )}>
                          {isActive ? "Payment Recorded" : "Awaiting Payment"}
                        </span>
                     </div>
                     <h2 className="text-3xl font-serif tracking-tight">
                       {isActive ? "Membership Activated" : "Application Received"}
                     </h2>
                  </div>
                  <button onClick={handleClose} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
                     <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="space-y-8">
                  {/* Summary Box */}
                  <div className="grid grid-cols-2 gap-8 py-8 border-y border-border/60">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Selected Tier</p>
                        <p className="text-lg font-bold tracking-tight">{subscription.plan.name}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                          {isActive ? "Renewal Date" : "Membership Starts"}
                        </p>
                        <p className="text-lg font-bold tracking-tight">
                          {isActive ? formatDate(subscription.endDate) : "On payment"}
                        </p>
                     </div>
                  </div>

                  {/* Supplemental Details */}
                  <div className="space-y-6">
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-primary" />
                        Provisioned Data
                     </h3>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1">
                           <p className="text-[9px] font-bold text-muted-foreground uppercase">Payment Method</p>
                           <div className="flex items-center gap-2 text-sm font-medium">
                              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                              {subscription.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Cash"}
                           </div>
                        </div>
                        
                        {isStudent && details.institution && (
                           <div className="space-y-1">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Affiliation</p>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                 <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                                 {details.institution}
                              </div>
                           </div>
                        )}

                        {isFamily && details.familyMembers && details.familyMembers.length > 0 && (
                           <div className="col-span-full space-y-2">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase">Associated Family Members</p>
                              <div className="flex flex-wrap gap-2">
                                 {details.familyMembers.map((m: any, i: number) => (
                                    <Badge key={i} variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-medium bg-muted/50 border-border/40">
                                       <User className={cn("w-3 h-3 mr-1.5 opacity-40", m.relation === 'ADULT' ? "text-foreground" : "text-primary")} />
                                       {m.name}
                                    </Badge>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                     {isActive
                       ? "Welcome to Kerala Samajam Augsburg. Your membership privileges are now active. You can manage your digital ID and registration history directly from your profile dashboard."
                       : "Thank you for applying to Kerala Samajam Augsburg. We have emailed your payment details — your membership begins on the day we record the payment, and we will confirm the dates then."}
                  </p>
               </div>

               <div className="pt-4">
                  <Button 
                    onClick={handleClose}
                    className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-foreground/10"
                  >
                    Enter Member Portal
                  </Button>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
