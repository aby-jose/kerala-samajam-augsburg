"use client";

import React from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/components/providers/config-provider";
import { WhatsAppCta } from "@/components/layout/whatsapp-cta";
import { getContactCaptcha, submitContactForm } from "@/lib/contact-actions";
import {
  Accent,
  Eyebrow,
  PageHeader,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { cn } from "@/lib/utils";
import { resolveSections } from "@/lib/page-layout";
import { CONTACT_SECTION_META } from "@/lib/page-content/contact-sections";
import { DEFAULT_CONTACT, type ContactContentT, type ContactSectionId } from "@/lib/page-content/contact";
import { withAccent } from "@/components/layout/with-accent";
import { InlineLinks } from "@/components/layout/inline-links";

const EASE = [0.16, 1, 0.3, 1] as const;

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  captchaCode: z.string().min(6, "Security code is required"),
  privacyConsent: z.literal(true, {
    message: "Please accept the Privacy Policy to send your message.",
  }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

/**
 * One field treatment for the whole form, so nothing drifts out of step.
 * Neutral grey rather than the cream used for section bands: a field is a
 * control, and it should not read as a tint of the page behind it. It clears
 * to white on focus, so the one you are filling in is the one that is lit.
 */
const fieldClass = (hasError?: boolean) =>
  cn(
    "w-full rounded-xl border bg-muted px-4 text-sm text-foreground outline-none transition-colors duration-300 placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface-1 focus:ring-2 focus:ring-primary/15",
    hasError ? "border-destructive/60" : "border-border"
  );

/** What actually happens to a message once it is sent. */
const steps = [
  {
    title: "It lands with the committee",
    body: "Not a ticketing system — the volunteers who run KSA read it themselves.",
  },
  {
    title: "Whoever knows the answer picks it up",
    body: "Membership, events and press each sit with a different person.",
  },
  {
    title: "You hear back",
    body: "Usually within a few days. Evenings and weekends are when we get to it.",
  },
];

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
 * 1. Page header — pinned to the top (see CONTACT_SECTION_META), so its
 * surface is always whatever position 0 in the rotation resolves to
 * (bg-surface-1 today, same as before this section had a `surface` prop).
 * Same opening as /about and /events: centred header, then one large piece
 * under it — here that piece is the three ways to reach us.
 */
function ContactHeroSection({
  content = DEFAULT_CONTACT.content.hero,
  surface = "bg-surface-1",
}: { content?: ContactContentT["content"]["hero"] } & SectionSurfaceProps) {
  const config = useConfig();
  const rise = useRiseVariants();
  const address = config.address || "Augsburg, Germany";

  // Every cell is a link, so the three read as one row rather than two
  // buttons and a label. Phone is optional in the site config — the cell is
  // dropped rather than showing a number nobody answers.
  const channels: {
    icon: LucideIcon;
    label: string;
    value: string;
    note: string;
    href: string;
    action: string;
    external?: boolean;
  }[] = [
    {
      icon: Mail,
      label: "Email",
      value: config.contactEmail,
      note: "The surest way to reach us. Everything here is read by a member of the committee.",
      href: `mailto:${config.contactEmail}`,
      action: "Write to us",
    },
    ...(config.contactPhone
      ? [
          {
            icon: Phone,
            label: "Phone",
            value: config.contactPhone,
            note: "Evenings and weekends are best — everyone here has a day job.",
            href: `tel:${config.contactPhone.replace(/\s+/g, "")}`,
            action: "Call us",
          },
        ]
      : []),
    ...(config.socials?.whatsapp
      ? [
          {
            icon: MessageCircle,
            label: "WhatsApp",
            value: "Community Group",
            note: "Join our WhatsApp community group directly to stay updated and chat with members.",
            href: config.socials.whatsapp,
            action: "Join Group",
            external: true,
          },
        ]
      : []),
    {
      icon: MapPin,
      label: "Where we are",
      value: address,
      note: "We meet across the city through the year, wherever the hall fits us.",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      action: "Open in Maps",
      external: true,
    },
  ];

  return (
    <section className={cn("overflow-hidden pb-20 pt-40", surface)}>
      <Container className="max-w-7xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={rise}
          className="space-y-12"
        >
          <PageHeader
            eyebrow={content.eyebrow}
            title={withAccent(content.title, content.accentWord)}
            lead={content.lead}
          />

          <motion.div
            className={cn(
              "grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border",
              channels.length === 4
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : channels.length > 2
                ? "md:grid-cols-3"
                : "md:grid-cols-2"
            )}
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {channels.map((channel) => (
              <motion.a
                key={channel.label}
                variants={rise}
                href={channel.href}
                {...(channel.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="group flex flex-col bg-surface-1 p-7 transition-colors duration-300 hover:bg-muted/40 md:p-9"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-primary transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <channel.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>

                <span className="mt-6 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {channel.label}
                </span>
                <span className="mt-2 block break-words font-sans text-lg font-bold tracking-[-0.02em] text-foreground">
                  {channel.label === "Email" && channel.value.includes("@") ? (
                    <>
                      {channel.value.slice(0, channel.value.indexOf("@") + 1)}
                      <wbr />
                      {channel.value.slice(channel.value.indexOf("@") + 1)}
                    </>
                  ) : (
                    channel.value
                  )}
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                  {channel.note}
                </span>

                <span className="mt-6 flex items-center gap-2 pt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                  {channel.action}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2.4}
                  />
                </span>
              </motion.a>
            ))}
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

/**
 * 2. The form. Tinted (bg-surface-2) at the default order rather than the
 * white surface-1 this section used before position-derived backgrounds —
 * expected and intended, see lib/page-layout.ts. The card inside stays white
 * regardless, so its edge still does the separating.
 */
function ContactFormSection({
  content = DEFAULT_CONTACT.content.form,
  surface = "bg-surface-2",
  bordered = true,
}: { content?: ContactContentT["content"]["form"] } & SectionSurfaceProps) {
  const config = useConfig();
  const rise = useRiseVariants();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [captcha, setCaptcha] = React.useState<{
    id: string;
    code: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      captchaCode: "",
      // Never pre-ticked — consent has to be a positive act.
      privacyConsent: false as unknown as true,
    },
  });

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
    } catch {
      setError("An unexpected error occurred. Please try again.");
      fetchCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className={cn("py-20 md:py-24", surface, bordered && "border-y border-border")}>
      <Container className="max-w-7xl">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <SectionTitle className="mt-6">
              {withAccent(content.title, content.accentWord)}
            </SectionTitle>
          </div>
          <SectionLead className="max-w-sm md:text-right">{content.lead}</SectionLead>
        </div>

        <div className="grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-12">
          {/* ---------------- The form ---------------- */}
          <motion.div
            className="lg:col-span-7"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {/* White regardless of the band behind it, so its edge does the
                separating — a soft lift rather than the flat shadow that
                worked when it always sat on a white background. */}
            <div className="rounded-3xl border border-border bg-surface-1 p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.25)] sm:p-8">
              <AnimatePresence mode="wait">
                {!isSent ? (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                      <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        <span className="h-px w-6 bg-border" />
                        Message form
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                        {config.siteName} e.V.
                      </span>
                    </div>

                    <AnimatePresence mode="wait">
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs font-semibold text-destructive"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Full name" error={errors.name?.message}>
                        <input
                          {...register("name")}
                          placeholder="Your name"
                          className={cn(fieldClass(!!errors.name), "h-11")}
                        />
                      </Field>
                      <Field
                        label="Email address"
                        error={errors.email?.message}
                      >
                        <input
                          type="email"
                          {...register("email")}
                          placeholder="you@example.com"
                          className={cn(fieldClass(!!errors.email), "h-11")}
                        />
                      </Field>
                    </div>

                    <Field label="Subject" error={errors.subject?.message}>
                      <input
                        {...register("subject")}
                        placeholder="How can we help?"
                        className={cn(fieldClass(!!errors.subject), "h-11")}
                      />
                    </Field>

                    <Field
                      label="Your message"
                      error={errors.message?.message}
                    >
                      <textarea
                        {...register("message")}
                        rows={4}
                        placeholder="Tell us a little about what you need…"
                        className={cn(
                          fieldClass(!!errors.message),
                          "min-h-[120px] py-3 leading-relaxed"
                        )}
                      />
                    </Field>

                    <Field
                      label="Security check"
                      error={errors.captchaCode?.message}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-muted">
                          <span className="select-none font-mono text-lg font-bold tracking-[0.35em] text-foreground/80">
                            {captcha?.code || "······"}
                          </span>
                          <button
                            type="button"
                            onClick={fetchCaptcha}
                            aria-label="Get a new code"
                            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Code"
                          {...register("captchaCode")}
                          className={cn(
                            fieldClass(!!errors.captchaCode),
                            "h-11 w-28 text-center font-bold uppercase tracking-[0.2em] placeholder:tracking-normal placeholder:font-normal"
                          )}
                        />
                      </div>
                    </Field>

                    {/* The schema and the server action both require this,
                        and the action records the consent — without the box
                        the form validates against a field with no UI and
                        silently refuses to send. */}
                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          {...register("privacyConsent")}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary"
                        />
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          I have read the{" "}
                          <Link
                            href="/legal/privacy"
                            className="font-semibold text-foreground underline decoration-border decoration-1 underline-offset-4 transition-colors duration-300 hover:text-primary hover:decoration-primary"
                          >
                            Privacy Policy
                          </Link>{" "}
                          and agree that my details may be used to answer this
                          message.
                        </span>
                      </label>
                      {errors.privacyConsent && (
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {errors.privacyConsent.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="group h-11 w-full rounded-full px-9 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Send Message
                          <Send className="ml-2.5 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      We never pass your details on
                    </p>
                  </motion.form>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-7 py-10 text-center"
                  >
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted text-primary">
                      <CheckCircle2 className="h-6 w-6" strokeWidth={1.7} />
                    </span>
                    <div>
                      <h2 className="font-sans text-[1.75rem] font-extrabold leading-[1.1] tracking-[-0.035em] text-foreground">
                        Message <Accent>Sent</Accent>
                      </h2>
                      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                        Thank you — your message is with the committee and
                        someone will be in touch.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsSent(false)}
                      className="h-12 rounded-full border-border bg-transparent px-9 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500 hover:border-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      Send Another
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ---------------- What happens to it ---------------- */}
          <motion.div
            className="lg:col-span-5"
            variants={rise}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-px w-6 bg-border" />
              What happens next
            </span>

            {/* An index rather than boxes — the form beside it is already a
                panel, and two panels side by side read as a pile. */}
            <motion.ol
              className="mt-6"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
            >
              {steps.map((step, i) => (
                <motion.li
                  key={step.title}
                  variants={rise}
                  className="group relative flex gap-5 border-t border-border py-5"
                >
                  {/* The rule redraws in primary on hover — the same gesture
                      the indexes on the home page use. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
                  />
                  <span className="pt-1 font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ol>

            <div className="mt-8 rounded-3xl border border-border bg-muted/50 p-6">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Registered association
              </span>
              <p className="mt-3 font-sans text-lg font-bold tracking-[-0.02em] text-foreground">
                {config.siteName} e.V.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Run entirely by volunteers. Nobody here is paid, and nobody
                here is a customer — which is also why a reply takes a few
                days rather than a few minutes.
              </p>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}

/**
 * 3. Asked often — the same gapless cell grid /about uses for "Where We Come
 * From". Most messages ask one of these four things.
 */
function ContactFaqSection({
  content = DEFAULT_CONTACT.content.faq,
  surface = "bg-surface-1",
  bordered = false,
}: { content?: ContactContentT["content"]["faq"] } & SectionSurfaceProps) {
  const rise = useRiseVariants();

  return (
    <section className={cn("py-24 md:py-32", surface, bordered && "border-y border-border")}>
      <Container className="max-w-7xl">
        <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Eyebrow>{content.eyebrow}</Eyebrow>
            <SectionTitle className="mt-6">
              {withAccent(content.title, content.accentWord)}
            </SectionTitle>
          </div>
          <SectionLead className="max-w-sm md:text-right">{content.lead}</SectionLead>
        </div>

        <motion.div
          className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {content.items.map((item, i) => (
            <motion.div
              key={i}
              variants={rise}
              className={cn("group p-7 transition-colors duration-300 hover:bg-muted/40 md:p-9", surface)}
            >
              <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 font-sans text-lg font-bold tracking-[-0.02em] text-foreground">
                {item.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                <InlineLinks text={item.answer} />
              </p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}

/**
 * 4. Come say hello — closing band. Same ambient treatment as the closing
 * bands on /events and /about, so the pages end on one note.
 */
function ContactVisitSection({
  content = DEFAULT_CONTACT.content.visit,
  surface = "bg-surface-deep",
}: { content?: ContactContentT["content"]["visit"] } & SectionSurfaceProps) {
  const rise = useRiseVariants();

  return (
    <section className={cn("relative overflow-hidden py-24 md:py-32", surface)}>
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
        }}
      />

      <Container className="relative">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          variants={rise}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <div className="flex justify-center">
            <Eyebrow tone="dark">{content.eyebrow}</Eyebrow>
          </div>

          <SectionTitle tone="dark" className="mt-7">
            {withAccent(content.title, content.accentWord)}
          </SectionTitle>

          <SectionLead tone="dark" className="mx-auto mt-6 max-w-xl">
            {content.lead}
          </SectionLead>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/events" className="group w-full sm:w-auto">
              <Button className="h-12 w-full rounded-full px-9 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                See Upcoming Events
                <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/membership" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
              >
                Become a Member
              </Button>
            </Link>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}

const CONTACT_SECTION_COMPONENTS: Record<ContactSectionId, ComponentType<any>> = {
  hero: ContactHeroSection,
  form: ContactFormSection,
  faq: ContactFaqSection,
  visit: ContactVisitSection,
  whatsappCta: WhatsAppCta,
};

export function ContactClient({ content }: { content: ContactContentT }) {
  const sections = resolveSections(CONTACT_SECTION_META, content.layout);

  return (
    <main className="flex min-h-screen flex-col bg-background selection:bg-primary/5">
      {sections.map(({ id, surface, tone, bordered }) => {
        const Section = CONTACT_SECTION_COMPONENTS[id as ContactSectionId];

        return (
          <Section
            key={id}
            content={content.content[id as ContactSectionId]}
            surface={surface}
            tone={tone}
            bordered={bordered}
          />
        );
      })}
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block pl-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1.5 pl-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
