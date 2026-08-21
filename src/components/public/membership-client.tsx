"use client";
import React, { useState } from "react";
import type { ComponentType } from "react";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  Users,
  GraduationCap,
  User,
  Wallet
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoginModal } from "@/components/auth/login-modal";
import { cn } from "@/lib/utils";
import MembershipFormModal from "./membership-form-modal";
import {
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { withAccent } from "@/components/layout/with-accent";
import { resolveSections } from "@/lib/page-layout";
import { MEMBERSHIP_SECTION_META } from "@/lib/page-content/membership-sections";
import {
  DEFAULT_MEMBERSHIP,
  type MembershipContentT,
  type MembershipSectionId,
} from "@/lib/page-content/membership";
import { MEMBERSHIP_ICON_MAP } from "@/lib/page-content/membership-icons";
import { WhatsAppCta } from "@/components/layout/whatsapp-cta";

const EASE = [0.16, 1, 0.3, 1] as const;

const getPlanIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("student")) return GraduationCap;
  if (lowerName.includes("family")) return Users;
  return User;
};

/** Plans are stored as a Float, so a whole euro amount should not read "€60.00". */
const formatPrice = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

/** The DB keeps duration as a shouty enum — never show it raw. */
const periodLabel = (duration: string) => {
  switch ((duration || "").toUpperCase()) {
    case "MONTHLY":
      return "per month";
    case "LIFETIME":
      return "one-time";
    default:
      return "per year";
  }
};

/** The same dotted texture the dark bands on /about and the home page carry. */
const DOT_TEXTURE: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)",
  backgroundSize: "22px 22px",
  maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%, black, transparent)",
  WebkitMaskImage:
    "radial-gradient(ellipse 90% 70% at 50% 0%, black, transparent)",
};

/** Every section respects prefers-reduced-motion independently — each one
 *  calls this itself rather than threading a boolean prop down. */
function useRiseVariants(): Variants {
  const reduced = useReducedMotion();
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

type SectionSurfaceProps = {
  surface?: string;
  tone?: "surface" | "dark";
  bordered?: boolean;
};

/**
 * One tier.
 *
 * The recommended plan is not a light card wearing a coloured ring — it is the
 * page's dark band shrunk to card size, with the glow, the dot texture and the
 * primary hairline it carries everywhere else. That makes it the obvious pick
 * in the row without introducing a treatment the site does not already use.
 */
function PlanCard({
  plan,
  index,
  onSelect,
}: {
  plan: any;
  index: number;
  onSelect: () => void;
}) {
  const featured = Boolean(plan.isPopular);
  const Icon = getPlanIcon(plan.name);

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border p-6 transition-all duration-500 md:p-7",
        featured
          ? "border-white/10 bg-surface-deep shadow-[0_30px_70px_-40px_rgba(0,0,0,0.75)] hover:border-white/20"
          : "border-border bg-surface-1 hover:border-foreground/20"
      )}
    >
      {featured && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-full bg-primary/25 blur-[90px] transition-opacity duration-700 group-hover:opacity-80"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={DOT_TEXTURE}
          />
          {/* Lit top edge — the one line of colour on the card. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary to-transparent"
          />
        </>
      )}

      <div className="relative flex items-center justify-between gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-300",
            featured
              ? "border-primary/25 bg-primary/15 text-white"
              : "border-primary/10 bg-primary/[0.08] text-primary group-hover:border-primary/25 group-hover:bg-primary/[0.16]"
          )}
        >
          <Icon strokeWidth={1.6} className="h-[18px] w-[18px]" />
        </span>

        {featured ? (
          /* Dot + tracked caps, i.e. the site's eyebrow, in badge form. */
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md">
            <span className="h-1 w-1 rounded-full bg-primary" />
            Most chosen
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <h3
        className={cn(
          "relative mt-5 font-sans text-[17px] font-bold leading-snug tracking-[-0.02em]",
          featured ? "text-white" : "text-foreground"
        )}
      >
        {plan.name}
      </h3>
      {plan.description && (
        // Clamped so one wordy plan cannot push its price out of line with the
        // others in the row.
        <p
          className={cn(
            "relative mt-1.5 line-clamp-2 text-[13px] leading-relaxed",
            featured ? "text-white/55" : "text-muted-foreground"
          )}
        >
          {plan.description}
        </p>
      )}

      <div
        className={cn(
          "relative mt-5 border-t pt-5",
          featured ? "border-white/10" : "border-border"
        )}
      >
        <div className="flex items-start gap-1">
          <span
            className={cn(
              "mt-1 font-sans text-base font-bold tracking-[-0.02em]",
              featured ? "text-white/50" : "text-muted-foreground"
            )}
          >
            €
          </span>
          <span
            className={cn(
              "font-sans text-[2.25rem] font-extrabold leading-none tracking-[-0.045em]",
              featured ? "text-white" : "text-foreground"
            )}
          >
            {formatPrice(plan.price)}
          </span>
        </div>
        <span
          className={cn(
            "mt-2 block text-[10px] font-semibold uppercase tracking-[0.18em]",
            featured ? "text-white/45" : "text-muted-foreground"
          )}
        >
          {periodLabel(plan.duration)}
        </span>
      </div>

      <ul className="relative mt-5 space-y-2.5">
        {plan.features.map((feature: string, i: number) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full",
                featured ? "bg-primary/20" : "bg-primary/10"
              )}
            >
              <Check strokeWidth={3} className="h-2.5 w-2.5 text-primary" />
            </span>
            <span
              className={cn(
                "text-[13px] leading-snug",
                featured ? "text-white/70" : "text-foreground/75"
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto pt-7">
        <Button
          onClick={onSelect}
          variant={featured ? "default" : "outline"}
          className={cn(
            "group/btn h-11 w-full rounded-full text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-500 hover:-translate-y-0.5",
            featured
              ? "shadow-lg shadow-primary/25"
              : "border-border bg-surface-1 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground"
          )}
        >
          Become a Member
          <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover/btn:translate-x-1" />
        </Button>
      </div>
    </div>
  );
}

/**
 * 1. Page header — pinned to the top (see MEMBERSHIP_SECTION_META), so its
 * surface is always whatever position 0 in the rotation resolves to
 * (bg-surface-1 today, same as before this section had a `surface` prop).
 * Top padding lives here, not on <main>, so the page opens under the
 * transparent navbar like /events and /about do.
 */
function MembershipHeroSection({
  content = DEFAULT_MEMBERSHIP.content.hero,
  surface = "bg-surface-1",
}: { content?: MembershipContentT["content"]["hero"] } & SectionSurfaceProps) {
  return (
    <section className={cn("pb-20 pt-40", surface)}>
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <PageHeader
            eyebrow={content.eyebrow}
            title={withAccent(content.title, content.accentWord)}
            lead={content.lead}
          />
        </motion.div>
      </Container>
    </section>
  );
}

/** 2. Membership tiers. */
function MembershipPlansSection({
  content = DEFAULT_MEMBERSHIP.content.plans,
  surface = "bg-surface-2",
  bordered = true,
  // Defaulted like every other prop here, per the rule that a section must
  // still render with nothing passed in — this one just renders the empty
  // state rather than a plan grid.
  plans = [],
  onSelectPlan = () => {},
}: {
  content?: MembershipContentT["content"]["plans"];
  plans?: any[];
  onSelectPlan?: (plan: any) => void;
} & SectionSurfaceProps) {
  const rise = useRiseVariants();
  const displayPlans = [...plans].sort((a, b) => a.price - b.price);

  /**
   * The column count follows the number of plans so the row always ends flush
   * — four tiers go four-across on xl rather than leaving one orphan on a
   * second row, and a short list is centred instead of stretched wide.
   */
  const gridCols =
    displayPlans.length === 1
      ? "mx-auto max-w-sm"
      : displayPlans.length === 2
      ? "mx-auto max-w-3xl sm:grid-cols-2"
      : displayPlans.length === 3
      ? "mx-auto max-w-5xl sm:grid-cols-2 lg:grid-cols-3"
      : displayPlans.length === 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className={cn("relative overflow-hidden py-24 md:py-32", surface, bordered && "border-y border-border")}>
      <Container className="relative max-w-7xl">
        {/* Header: title left, the one line of context right — same split as
            the "What we do" index on the home page. */}
        <motion.div
          className="grid grid-cols-1 items-end gap-x-16 gap-y-6 lg:grid-cols-12"
          variants={rise}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="lg:col-span-7">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <SectionTitle className="mt-6">
              {withAccent(content.title, content.accentWord)}
            </SectionTitle>
          </div>
          <SectionLead className="lg:col-span-5">{content.lead}</SectionLead>
        </motion.div>

        {displayPlans.length === 0 ? (
          <div className="mt-14 flex flex-col items-start gap-5 rounded-[1.5rem] border border-dashed border-border px-7 py-12">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-1 text-muted-foreground">
              <Wallet className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div>
              <p className="font-sans text-lg font-bold tracking-[-0.015em] text-foreground">
                Plans are being updated
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                The fees for the coming year are not published yet. Write to
                us and we will tell you what membership costs today.
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            className={cn("mt-14 grid grid-cols-1 gap-5 md:mt-16", gridCols)}
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
          >
            {displayPlans.map((plan, idx) => (
              <motion.div key={plan.id} variants={rise} className="h-full">
                <PlanCard
                  plan={plan}
                  index={idx}
                  onSelect={() => onSelectPlan(plan)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Never end the grid on a hard stop — someone unsure which tier fits
            needs a way out that is not the back button. */}
        <div className="mt-12 flex flex-col items-start gap-3 border-t border-border pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Not sure which one fits your family? Ask us before you pay.
          </p>
          <Link
            href="/contact"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <span className="border-b border-foreground/30 pb-0.5 transition-colors group-hover:border-primary group-hover:text-primary">
              Talk to us first
            </span>
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

/** 3. Benefits. */
function MembershipBenefitsSection({
  content = DEFAULT_MEMBERSHIP.content.benefits,
  surface = "bg-surface-1",
}: { content?: MembershipContentT["content"]["benefits"] } & SectionSurfaceProps) {
  return (
    <section className={cn("py-24 md:py-32", surface)}>
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
             <div className="space-y-6">
                <Eyebrow>{content.eyebrow}</Eyebrow>
                <SectionTitle>
                  {withAccent(content.title, content.accentWord)}
                </SectionTitle>
             </div>
             <SectionLead>{content.lead}</SectionLead>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                {content.items.slice(0, 4).map((benefit, i) => {
                  // Falls back rather than crashing: a hand-edited document
                  // or a future narrowing of MEMBERSHIP_ICONS can produce an
                  // icon string this map does not recognise.
                  const Icon = MEMBERSHIP_ICON_MAP[benefit.icon] ?? Globe;
                  return (
                    <div key={i} className="space-y-3">
                       <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                             <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <h4 className="font-sans text-sm font-bold tracking-[-0.01em]">{benefit.title}</h4>
                       </div>
                       <p className="text-xs text-muted-foreground leading-relaxed">{benefit.description}</p>
                    </div>
                  );
                })}
             </div>
          </div>
          <div className="relative group">
             <div className="absolute inset-0 bg-primary/10 rounded-[3rem] -rotate-3 scale-[1.02] transition-transform group-hover:rotate-0" />
             <div className="relative aspect-square rounded-[3rem] bg-zinc-900 overflow-hidden border border-border/40 shadow-2xl">
                <Image
                  src={content.imageUrl}
                  alt={content.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
                />
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
  );
}

// Plans is the only section that needs anything beyond content/surface/tone/
// bordered — the plan list itself and the join handler are wired in below
// rather than added to every section's signature.
const MEMBERSHIP_SECTION_COMPONENTS: Record<MembershipSectionId, ComponentType<any>> = {
  hero: MembershipHeroSection,
  plans: MembershipPlansSection,
  benefits: MembershipBenefitsSection,
  whatsappCta: WhatsAppCta,
};

export default function MembershipClient({
  plans,
  content,
}: {
  plans: any[];
  content: MembershipContentT;
}) {
  const { data: session } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleJoin = (plan: any) => {
    setSelectedPlan(plan);
    if (!session) {
      setIsLoginOpen(true);
    } else {
      setIsFormOpen(true);
    }
  };

  const sections = resolveSections(MEMBERSHIP_SECTION_META, content.layout);

  return (
    <main className="flex min-h-screen flex-col bg-background selection:bg-primary/20">
      {sections.map(({ id, surface, tone, bordered }) => {
        const Section = MEMBERSHIP_SECTION_COMPONENTS[id as MembershipSectionId];
        const extraProps = id === "plans" ? { plans, onSelectPlan: handleJoin } : {};

        return (
          <Section
            key={id}
            content={content.content[id as MembershipSectionId]}
            surface={surface}
            tone={tone}
            bordered={bordered}
            {...extraProps}
          />
        );
      })}

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
