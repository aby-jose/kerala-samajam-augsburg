"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  MapPin,
  Share2,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Container } from "@/components/layout/container";
import { Countdown } from "@/components/layout/countdown";
import { Button } from "@/components/ui/button";
import {
  Accent,
  Eyebrow,
  PageTitle,
  SectionLead,
  SectionTitle,
} from "@/components/layout/section-heading";
import { EventBody } from "@/components/events/event-body";
import { RegistrationForm } from "@/components/events/registration-form";
import { getEventBySlug } from "@/lib/event-actions";
import { checkCurrentMemberStatus } from "@/lib/membership-actions";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** The dot grid shared by every dark band on the site. */
const DOT_GRID: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
  backgroundSize: "28px 28px",
  maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
  WebkitMaskImage:
    "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)",
};

type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventBySlug>>>;
type MemberStatus = Awaited<ReturnType<typeof checkCurrentMemberStatus>>;

const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** An unset price and a zero price both mean the same thing to a visitor. */
const asPrice = (value?: number | null) =>
  value ? `€${value.toFixed(2)}` : "Free";

export default function EventDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { data: session } = useSession();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [memberStatus, setMemberStatus] = useState<MemberStatus>({
    isMember: false,
    hasPending: false,
    status: null,
    plan: null,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const [eventData, status] = await Promise.all([
          getEventBySlug(slug as string),
          checkCurrentMemberStatus(),
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

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  const stagger: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
  };

  /** Native share sheet where there is one, clipboard everywhere else. */
  const handleShare = async () => {
    if (!event) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Dismissing the share sheet lands here — nothing worth reporting.
    }
  };

  // The skeleton is dark because the hero is: a white placeholder would flash
  // the wrong colour for as long as the fetch takes.
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col bg-surface-deep">
        <section className="pb-24 pt-32 md:pt-40">
          <Container className="max-w-7xl">
            <div className="grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                <span className="block h-7 w-32 animate-pulse rounded-full bg-white/[0.07]" />
                <span className="block h-12 w-4/5 animate-pulse rounded-2xl bg-white/[0.07]" />
                <span className="block h-12 w-3/5 animate-pulse rounded-2xl bg-white/[0.05]" />
                <span className="block h-24 w-full animate-pulse rounded-2xl bg-white/[0.04]" />
              </div>
              <div className="lg:col-span-5">
                <span className="block aspect-4/5 w-full animate-pulse rounded-[1.75rem] bg-white/[0.06]" />
              </div>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  if (!event) return null;

  const eventDate = new Date(event.date);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Same rule the calendar uses: an event stays "on" for the whole of its day
  // rather than falling into the past the moment it begins.
  const isPast = eventDate < startOfToday;
  const isCountingDown = !isPast && eventDate.getTime() > Date.now();

  const registered = event._count?.registrations ?? 0;
  const seatsLeft = event.maxAttendees
    ? Math.max(event.maxAttendees - registered, 0)
    : null;
  const isFull = seatsLeft === 0;
  const registrationOpen = !isPast && !isFull;

  const hasTieredPricing =
    event.memberPrice !== null || event.nonMemberPrice !== null;
  const legacyPrice = Number.parseFloat(event.price ?? "") || 0;
  const admission = hasTieredPricing
    ? `${asPrice(event.memberPrice)} members · ${asPrice(event.nonMemberPrice)} others`
    : legacyPrice > 0
      ? `€${legacyPrice.toFixed(2)}`
      : "Free entry";

  const timeLabel = event.startTime
    ? event.endTime
      ? `${event.startTime} — ${event.endTime}`
      : `From ${event.startTime}`
    : null;

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [event.location, event.address].filter(Boolean).join(", ")
  )}`;

  const status = isPast ? "Past event" : isFull ? "Fully booked" : "Upcoming event";

  // The panel leads with the one rate that applies to whoever is reading it,
  // rather than a two-row table they have to resolve against themselves.
  const yourRate = hasTieredPricing
    ? ((memberStatus.isMember ? event.memberPrice : event.nonMemberPrice) ?? 0)
    : legacyPrice;
  const isPaid = yourRate > 0;

  // Only ever shown to non-members, and only when joining genuinely costs less.
  const saving =
    !memberStatus.isMember &&
    event.memberPrice !== null &&
    event.nonMemberPrice !== null &&
    event.nonMemberPrice > event.memberPrice
      ? event.nonMemberPrice - event.memberPrice
      : null;

  // One caption line under the number instead of a uppercase unit beside it
  // and a second sentence below — the panel had six runs of 10px uppercase
  // and nothing set at a size you could actually read.
  //
  // When the join row is showing it already leads with the member rate, so the
  // caption drops it rather than printing the same figure twice in one block.
  const otherRateNote =
    !hasTieredPricing || saving !== null
      ? null
      : memberStatus.isMember
        ? `Everyone else pays ${asPrice(event.nonMemberPrice)}.`
        : `Members pay ${asPrice(event.memberPrice)}.`;

  const priceCaption = [
    isPaid ? "Per person." : hasTieredPricing ? null : "No charge — everyone is welcome.",
    otherRateNote,
  ]
    .filter(Boolean)
    .join(" ");

  const facts: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: event.requiresLogin ? Lock : Users,
      label: "Who can come",
      value: event.requiresLogin ? "Members only" : "Open to everyone",
    },
    { icon: Ticket, label: "Admission", value: admission },
    {
      icon: Users,
      label: "Attendance",
      value:
        seatsLeft !== null
          ? registered === 0
            ? `${event.maxAttendees} places, none taken yet`
            : `${seatsLeft} of ${event.maxAttendees} places left`
          : registered === 0
            ? "Open — no registrations yet"
            : `${registered} registered so far`,
    },
    {
      icon: Clock,
      label: "Timings",
      value: timeLabel ?? "Confirmed nearer the date",
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background selection:bg-primary/5">
      {/* ============ 1. Hero — the poster, at full volume ============ */}
      {/* The page opens dark for the same reason the home page does: an event
          is an occasion, and the artwork carries it. The poster doubles as the
          backdrop, blurred well past legibility so it reads as colour only. */}
      <section className="relative isolate overflow-hidden bg-surface-deep pb-14 pt-24 sm:pt-28 md:pb-28 md:pt-36">
        {event.imageUrl && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <img
              src={event.imageUrl}
              alt=""
              aria-hidden
              className="h-full w-full scale-125 object-cover opacity-40 blur-[80px]"
            />
          </div>
        )}

        {/* Scrims. Bottom-weighted so the type always sits on near-black while
            the colour survives further up. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/75 via-black/70 to-black/92"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/4 h-[520px] w-[680px] -translate-x-1/2 rounded-full bg-primary/20 blur-[130px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={DOT_GRID}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <Container className="relative max-w-7xl">
          <nav className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            <Link
              href="/events"
              className="transition-colors duration-300 hover:text-white"
            >
              Events
            </Link>
            <ChevronRight className="h-3 w-3 text-white/25" strokeWidth={2.5} />
            <span className="text-white/80">{event.category || "Event"}</span>
          </nav>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mt-6 grid grid-cols-1 gap-x-16 gap-y-8 sm:mt-8 sm:gap-y-10 md:mt-10 lg:grid-cols-12 lg:items-center"
          >
            {/* ---------------- The pitch ---------------- */}
            <motion.div variants={rise} className="lg:col-span-7">
              <Eyebrow tone="dark">{status}</Eyebrow>

              <PageTitle tone="dark" className="mt-5 sm:mt-7">
                {event.title}
              </PageTitle>

              {/* No summary here on purpose: the description lives once, in
                  full, under "About this event". A clamped copy of it would
                  read as duplication on the short ones. */}
              <div className="mt-6 flex flex-wrap items-start gap-x-6 gap-y-4 border-y border-white/10 py-5 sm:mt-8 sm:gap-x-10 sm:py-6 md:mt-9 md:py-7">
                <HeroMeta
                  icon={CalendarDays}
                  label="Date"
                  value={longDate(eventDate)}
                />
                {timeLabel && (
                  <HeroMeta icon={Clock} label="Time" value={timeLabel} />
                )}
                <HeroMeta icon={MapPin} label="Where" value={event.location} />
              </div>

              {isCountingDown && (
                <div className="mt-7 sm:mt-9">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Starts in
                  </span>
                  <Countdown targetDate={eventDate} className="mt-3 sm:mt-3.5" />
                </div>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row">
                {registrationOpen && (
                  <a href="#register" className="group w-full sm:w-auto">
                    <Button className="h-12 w-full rounded-full px-9 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 sm:w-auto">
                      Register Now
                      <ArrowRight
                        className="ml-2.5 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1"
                        strokeWidth={2.4}
                      />
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  onClick={handleShare}
                  className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[14px] font-semibold text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2.5 h-3.5 w-3.5" strokeWidth={2.4} />
                      Link Copied
                    </>
                  ) : (
                    <>
                      <Share2 className="mr-2.5 h-3.5 w-3.5" strokeWidth={2.2} />
                      Share Event
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* ---------------- The poster ---------------- */}
            {/* No aspect box and no object-cover: event posters carry dates,
                prices and a venue, so the frame takes its height from the
                artwork rather than cropping it to a ratio. */}
            <motion.div variants={rise} className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/60">
                {event.imageUrl ? (
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="block h-auto w-full"
                  />
                ) : (
                  <div className="flex aspect-4/5 w-full flex-col items-center justify-center gap-4 bg-linear-to-br from-white/[0.07] to-transparent">
                    <span className="font-serif text-6xl italic text-white/15">
                      KSA
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      {event.category || "Event"}
                    </span>
                  </div>
                )}

                {isPast && (
                  <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur-md">
                    Past event
                  </span>
                )}
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* ============ 2. Detail + registration — surface 1 ============ */}
      <section className="border-b border-border bg-surface-1 py-16 md:py-24 lg:py-32">
        <Container className="max-w-7xl">
          <div className="grid grid-cols-1 gap-x-12 gap-y-14 lg:grid-cols-12 xl:gap-x-16">
            {/* ---------------- Everything about the event ---------------- */}
            <motion.div
              className="lg:col-span-7"
              variants={rise}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
            >
              <Eyebrow>Overview</Eyebrow>

              <SectionTitle className="mt-6">
                About This <Accent>Event</Accent>
              </SectionTitle>

              {/* Written in the admin as light markdown, so it is parsed
                  rather than printed — otherwise every asterisk shows. */}
              <EventBody body={event.description} className="mt-8" />

              {/* Facts pulled from the event itself — nothing invented. A spec
                  sheet rather than four boxes: these are short values that
                  belong in one column you can run your eye down, and the venue
                  is the last row of it rather than a section of its own. */}
              <div className="mt-14">
                <span className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  <span className="h-px w-6 bg-border" />
                  Good to know
                </span>

                <dl className="mt-6 border-t border-border">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className="flex flex-col gap-1.5 border-b border-border py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                    >
                      <dt className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        <fact.icon
                          className="h-4 w-4 shrink-0 text-primary"
                          strokeWidth={1.8}
                        />
                        {fact.label}
                      </dt>
                      <dd className="font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground sm:text-right">
                        {fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* The one row that goes somewhere, so it carries the hover. */}
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group -mx-4 flex flex-col gap-1.5 border-b border-border px-4 py-4 transition-colors duration-300 hover:bg-muted/50 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
                >
                  <span className="flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <MapPin
                      className="h-4 w-4 shrink-0 text-primary"
                      strokeWidth={1.8}
                    />
                    Where
                  </span>

                  <span className="sm:text-right">
                    <span className="block font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground">
                      {event.location}
                    </span>
                    {event.address && (
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {event.address}
                      </span>
                    )}
                    <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      Open in Maps
                      <ArrowUpRight
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        strokeWidth={2.4}
                      />
                    </span>
                  </span>
                </a>
              </div>
            </motion.div>

            {/* ---------------- The ticket ---------------- */}
            {/* Admission, registration and the live count in one panel, built
                to read as a ticket: a grey stub on top, perforation, then the
                form. Three separate cards made the column look like a pile. */}
            <div className="lg:col-span-5">
              <motion.div
                className="overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.3)] lg:sticky lg:top-28"
                variants={rise}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
              >
                {/* --- Stub: what it costs --- */}
                <div className="border-b border-dashed border-border bg-muted/40 px-6 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Admission
                    </span>
                    {memberStatus.isMember && (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        Member rate
                      </span>
                    )}
                  </div>

                  {/* The number owns the block; everything else is a caption. */}
                  <p className="mt-3 font-sans text-[2.5rem] font-extrabold leading-none tracking-[-0.045em] text-foreground tabular-nums sm:text-5xl">
                    {isPaid ? `€${yourRate.toFixed(2)}` : "Free"}
                  </p>

                  {priceCaption && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {priceCaption}
                    </p>
                  )}

                  {/* Two registers and one accent colour: the rate leads in
                      foreground, the saving explains it underneath, and only
                      the tile and the arrow carry primary. A single flat line
                      of primary text read as a warning strip. */}
                  {saving !== null && (
                    <Link
                      href="/membership"
                      className="group mt-5 flex items-center gap-3.5 rounded-2xl border border-primary/15 bg-primary/[0.06] p-3.5 transition-colors duration-300 hover:border-primary/30 hover:bg-primary/[0.1] sm:gap-4 sm:p-4"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                        <Users className="h-5 w-5" strokeWidth={1.7} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-[15px] font-bold tracking-[-0.015em] text-foreground">
                          Members pay {asPrice(event.memberPrice)}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          €{saving.toFixed(2)} less — see how to join
                        </span>
                      </span>

                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-primary transition-transform duration-300 group-hover:translate-x-0.5"
                        strokeWidth={2.4}
                      />
                    </Link>
                  )}
                </div>

                {/* --- Body: how to get in --- */}
                <div id="register" className="scroll-mt-24 p-6 sm:p-7">
                  {isPast ? (
                    <ClosedPanel
                      icon={CheckCircle2}
                      title="This event has passed"
                      body="Registration is closed. Photographs usually land in the gallery a week or so afterwards, and the next dates are already on the calendar."
                      action={{ href: "/events", label: "See What's Next" }}
                    />
                  ) : isFull ? (
                    <ClosedPanel
                      icon={Users}
                      title="Fully booked"
                      body={`All ${event.maxAttendees} places have been taken. Drop us a line — places occasionally free up, and we will let you know if one does.`}
                      action={{ href: "/contact", label: "Ask About a Place" }}
                    />
                  ) : !session ? (
                    /* The action first: an icon tile and a heading above it
                       only pushed the one button anybody wants further down. */
                    <div className="space-y-4">
                      <Button
                        onClick={() => router.push(`${pathname}?auth=login`)}
                        className="group h-12 w-full rounded-full px-8 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40"
                      >
                        Sign In to Register
                        <ArrowRight
                          className="ml-2.5 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1"
                          strokeWidth={2.4}
                        />
                      </Button>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Registration runs through your account, so your ticket
                        and any member pricing follow you. It is emailed as soon
                        as your place is confirmed.
                      </p>
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
                </div>

                {/* --- Foot: where it stands --- */}
                {/* A hairline rather than a third tint band: the panel was
                    changing background three times over 400px. A bare count
                    also says nothing next to a cap, so it is drawn against it. */}
                <div className="border-t border-border px-6 py-5 sm:px-7">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2.5 font-semibold text-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          registrationOpen
                            ? "bg-primary"
                            : "bg-muted-foreground/40"
                        )}
                      />
                      {registrationOpen
                        ? "Registration open"
                        : "Registration closed"}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {seatsLeft !== null
                        ? `${seatsLeft} left`
                        : `${registered} registered`}
                    </span>
                  </div>

                  {event.maxAttendees ? (
                    <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                        style={{
                          width: `${Math.min(100, (registered / event.maxAttendees) * 100)}%`,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
          </div>
        </Container>
      </section>

      {/* ============ 3. Closing band — deep ============ */}
      {/* Same ambient treatment as the closing bands on /events and /about, so
          the pages end on one note. */}
      <section className="relative overflow-hidden bg-surface-deep py-16 md:py-24 lg:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.3]"
          style={DOT_GRID}
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
              <Eyebrow tone="dark">Questions</Eyebrow>
            </div>

            <SectionTitle tone="dark" className="mt-7">
              Anything Else You <Accent>Need to Know</Accent>?
            </SectionTitle>

            <SectionLead tone="dark" className="mx-auto mt-6 max-w-xl">
              Dietary needs, bringing the children, parking, lending a hand on
              the day — just ask. A member of the committee reads every message.
            </SectionLead>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contact" className="group w-full sm:w-auto">
                <Button className="h-12 w-full rounded-full px-9 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 sm:w-auto">
                  Ask the Committee
                  <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/events" className="w-full sm:w-auto">
                <Button
                  variant="ghost"
                  className="h-12 w-full rounded-full border border-white/15 bg-white/[0.06] px-9 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  See All Events
                </Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>
    </main>
  );
}

/** One date/time/place fact in the hero, on dark. */
function HeroMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-primary sm:h-9 sm:w-9">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </p>
        <p className="mt-1 break-words font-sans text-sm font-bold tracking-[-0.015em] text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

/** Shown in place of the form when registration cannot be taken. */
function ClosedPanel({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  return (
    <div className="space-y-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <div>
        <h3 className="font-sans text-lg font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
      <Link href={action.href} className="group block">
        <Button
          variant="outline"
          className="h-12 w-full rounded-full border-border bg-transparent px-8 text-[14px] font-semibold transition-all duration-500 hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          {action.label}
          <ArrowRight
            className="ml-2.5 h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-1"
            strokeWidth={2.4}
          />
        </Button>
      </Link>
    </div>
  );
}
