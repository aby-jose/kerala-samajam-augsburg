"use client";
import React, { useState } from "react";

import { motion, Variants } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Check, 
  Sparkles, 
  Users, 
  GraduationCap, 
  User, 
  Globe, 
  HeartHandshake, 
  Calendar,
  Vote
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoginModal } from "@/components/auth/login-modal";
import { cn } from "@/lib/utils";
import MembershipFormModal from "./membership-form-modal";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 50, damping: 20, duration: 0.8 }
  },
};

const getPlanIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("student")) return GraduationCap;
  if (lowerName.includes("family")) return Users;
  return User;
};

const benefits = [
  {
    title: "Cultural Connection",
    description: "Stay deeply connected to Kerala's rich traditions through celebrations like Onam, Vishu, and Christmas.",
    icon: Globe
  },
  {
    title: "Community Network",
    description: "Build meaningful relationships with over 200+ Malayali families living in the Augsburg region.",
    icon: HeartHandshake
  },
  {
    title: "Support System",
    description: "Access a collective knowledge base for navigating life in Germany, from integration to professional growth.",
    icon: Sparkles
  },
  {
    title: "Youth Development",
    description: "Provide your children with a platform to learn their heritage and develop leadership skills.",
    icon: GraduationCap
  },
  {
    title: "Event Access",
    description: "Get exclusive entry or discounted rates for KSA's year-round cultural workshops and gatherings.",
    icon: Calendar
  },
  {
    title: "Citizen Voice",
    description: "Have your say in the organization's future through voting and participating in the General Body.",
    icon: Vote
  }
];

export default function MembershipClient({ plans }: { plans: any[] }) {
  const { data: session } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const displayPlans = [...plans].sort((a, b) => a.price - b.price);

  const handleJoin = (plan: any) => {
    setSelectedPlan(plan);
    if (!session) {
      setIsLoginOpen(true);
    } else {
      setIsFormOpen(true);
    }
  };

  return (
    <main className="min-h-screen pt-36 pb-20 bg-background selection:bg-primary/20">
      {/* Page header — surface 1 */}
      <section className="py-24 bg-surface-1">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <PageHeader
              eyebrow="Membership"
              title={<>Become a <Accent>Member</Accent></>}
              lead="One fee for the year. It pays for the halls, the sound system and the rice — and it keeps the festivals, the classes and the stage running."
            />
          </motion.div>
        </Container>
      </section>

      {/* Membership tiers — surface 2 */}
      <section className="py-24 md:py-32 bg-surface-2 border-y border-border">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {displayPlans.map((plan, idx) => {
              const isHighlight = plan.isPopular;
              
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className={cn(
                    "h-full flex flex-col rounded-2xl border",
                    isHighlight 
                      ? "border-primary/50 shadow-xl shadow-primary/5 ring-1 ring-primary/20" 
                      : "border-border/40 hover:border-border"
                  )}>
                    <CardHeader className="p-8 pb-4">
                      <div className="flex justify-between items-start mb-6">
                        <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        {isHighlight && (
                          <Badge className="bg-primary text-white rounded-lg px-3 py-1 text-[10px] font-bold border-none transition-none">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-2xl font-bold tracking-tight">{plan.name}</CardTitle>
                      <CardDescription className="text-sm font-medium uppercase tracking-wider text-muted-foreground pt-1">
                        {plan.duration} Commitment
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="p-8 pt-0 grow space-y-8">
                      <div className="flex items-baseline gap-1 pt-4 border-t border-border/40">
                         <span className="text-4xl font-bold tracking-tighter">€{plan.price}</span>
                         <span className="text-sm text-muted-foreground font-medium lowercase">/ {plan.duration}</span>
                      </div>
                      
                      <ul className="space-y-4">
                        {plan.features.map((feature: string, i: number) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span className="text-sm text-foreground/80 leading-snug">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    
                    <CardFooter className="p-8 pt-0">
                        <Button 
                          variant={isHighlight ? "default" : "outline"} 
                          onClick={() => handleJoin(plan)}
                          className={cn(
                            "w-full h-12 rounded-xl text-sm font-bold transition-none",
                            isHighlight ? "shadow-lg shadow-primary/20" : ""
                          )}
                        >
                        Select Tier
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Benefits — surface 1 */}
      <section className="py-24 md:py-32 bg-surface-1">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
               <div className="space-y-6">
                  <Eyebrow>Benefits</Eyebrow>
                  <SectionTitle>
                    What Membership <Accent>Gives You</Accent>
                  </SectionTitle>
               </div>
               <SectionLead>
                 Members get the invitations first, a say in how the Verein is
                 run, and a vote at the general meeting. Beyond that, it is the
                 simplest way to keep all of this going.
               </SectionLead>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                  {benefits.slice(0, 4).map((benefit) => (
                    <div key={benefit.title} className="space-y-3">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                             <benefit.icon className="h-4 w-4 text-primary" />
                          </div>
                          <h4 className="font-sans text-sm font-bold tracking-[-0.01em]">{benefit.title}</h4>
                       </div>
                       <p className="text-xs text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  ))}
               </div>
            </div>
            <div className="relative group">
               <div className="absolute inset-0 bg-primary/10 rounded-[3rem] -rotate-3 scale-[1.02] transition-transform group-hover:rotate-0" />
               <div className="relative aspect-square rounded-[3rem] bg-zinc-900 overflow-hidden border border-border/40 shadow-2xl">
                  <img src="/images/gallery/community_picnic.png" className="w-full h-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105" alt="KSA members at a community gathering in Augsburg" />
                  <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-transparent to-transparent" />
                  <div className="absolute bottom-12 left-12 right-12 space-y-2">
                     <p className="font-sans text-2xl font-extrabold leading-tight tracking-[-0.03em] text-white">Kerala in Augsburg,<br /> since 2012.</p>
                     <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Kerala Samajam Augsburg e.V.</p>
                  </div>
               </div>
            </div>
          </div>
        </Container>
      </section>

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onSuccess={() => {
          setIsLoginOpen(false);
          setIsFormOpen(true);
        }}
      />

      {selectedPlan && session && (
        <MembershipFormModal 
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          plan={selectedPlan}
          user={session.user}
        />
      )}
    </main>
  );
}
