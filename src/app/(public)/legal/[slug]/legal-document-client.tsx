"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, FileText, Languages, ShieldCheck } from "lucide-react";

import { Container } from "@/components/layout/container";
import {
  Accent,
  Eyebrow,
  PageTitle,
  SectionLead,
} from "@/components/layout/section-heading";
import { LegalBody } from "@/components/legal/legal-body";
import { cn } from "@/lib/utils";
import { LegalContent, LegalDocMeta, LegalLocale, LegalSlug } from "@/lib/legal-schema";

interface Props {
  meta: LegalDocMeta;
  /** Already placeholder-resolved on the server. */
  content: Record<LegalLocale, LegalContent>;
  version: number;
  effectiveFrom: string;
  requiresConsent: boolean;
  /** The other documents, for the cross-links at the foot of the page. */
  siblings: { slug: LegalSlug; label: Record<LegalLocale, string> }[];
}

const LOCALE_LABEL: Record<LegalLocale, string> = { de: "Deutsch", en: "English" };

const COPY = {
  de: {
    binding: "Die deutsche Fassung ist maßgeblich.",
    version: "Fassung",
    effective: "Stand",
    consent: "Zustimmungspflichtig",
    consentHint:
      "Bei wesentlichen Änderungen bitten wir angemeldete Mitglieder erneut um Zustimmung.",
    other: "Weitere rechtliche Hinweise",
  },
  en: {
    binding: "The German version is the legally binding text.",
    version: "Version",
    effective: "Last updated",
    consent: "Requires consent",
    consentHint:
      "Where changes are material we ask signed-in members to agree again.",
    other: "Other legal pages",
  },
} as const;

/** Split the title so the last word can take the serif italic accent. */
function splitTitle(title: string) {
  const words = title.trim().split(" ");
  if (words.length === 1) return { head: "", tail: words[0] };
  return { head: words.slice(0, -1).join(" "), tail: words[words.length - 1] };
}

export function LegalDocumentClient({
  meta,
  content,
  version,
  effectiveFrom,
  requiresConsent,
  siblings,
}: Props) {
  const [locale, setLocale] = React.useState<LegalLocale>("de");

  // German is the binding text, so it is what loads first. A visitor who has
  // chosen English before keeps that choice on their next legal page.
  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ksa_legal_locale");
      if (stored === "de" || stored === "en") setLocale(stored);
    } catch {
      // Private mode or storage disabled — the German default is fine.
    }
  }, []);

  const chooseLocale = (next: LegalLocale) => {
    setLocale(next);
    try {
      window.localStorage.setItem("ksa_legal_locale", next);
    } catch {
      // Not worth surfacing — the page still works.
    }
  };

  const doc = content[locale];
  const copy = COPY[locale];
  const { head, tail } = splitTitle(doc.title);

  const formattedDate = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(effectiveFrom));
    } catch {
      return effectiveFrom.slice(0, 10);
    }
  }, [effectiveFrom, locale]);

  return (
    <main className="flex min-h-screen flex-col bg-background selection:bg-primary/5">
      {/* 1. Page header — surface 1 */}
      <section className="overflow-hidden bg-surface-1 pt-40 pb-20">
        <Container className="max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="flex justify-center">
              <Eyebrow>{meta.eyebrow[locale]}</Eyebrow>
            </div>

            <PageTitle className="mt-7">
              {head && <>{head} </>}
              <Accent>{tail}</Accent>
            </PageTitle>

            {doc.lead && (
              <SectionLead className="mx-auto mt-6 max-w-xl">{doc.lead}</SectionLead>
            )}

            {/* Version strip + language switcher */}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                <FileText className="h-3.5 w-3.5 text-primary/60" />
                {copy.version} {version}
              </span>
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                <CalendarClock className="h-3.5 w-3.5 text-primary/60" />
                {copy.effective} {formattedDate}
              </span>

              <div className="inline-flex items-center rounded-full border border-border bg-surface-1/60 p-1 backdrop-blur-sm">
                <Languages className="mx-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                {(["de", "en"] as LegalLocale[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => chooseLocale(code)}
                    aria-pressed={locale === code}
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-all",
                      locale === code
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {LOCALE_LABEL[code]}
                  </button>
                ))}
              </div>
            </div>

            {locale === "en" && (
              <p className="mt-4 text-xs italic text-muted-foreground/70">{copy.binding}</p>
            )}
          </motion.div>
        </Container>
      </section>

      {/* 2. Document — surface 2 */}
      <section className="border-y border-border bg-surface-2 py-24 md:py-32">
        <Container className="max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="overflow-hidden rounded-4xl border border-border/50 bg-secondary/5 shadow-xs"
          >
            {/* Body */}
            <article className="p-8 md:p-12">
              {/* The consent note used to sit under the table of contents;
                  with that column gone it opens the document instead. */}
              {requiresConsent && (
                <div className="mb-12 rounded-2xl border border-border/50 bg-background/50 p-5">
                  <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-primary/70">
                    <ShieldCheck className="h-3 w-3" />
                    {copy.consent}
                  </span>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {copy.consentHint}
                  </p>
                </div>
              )}

              <div className="space-y-12">
                {doc.sections.map((section) => (
                  <section key={section.id} id={section.id} className="scroll-mt-28">
                    <h2 className="font-sans text-xl font-extrabold tracking-[-0.03em] text-foreground">
                      {section.heading}
                    </h2>
                    <div className="mt-4 h-px w-10 bg-primary/30" />
                    <LegalBody body={section.body} className="mt-5" />
                  </section>
                ))}
              </div>

              {/* Cross-links */}
              <div className="mt-16 border-t border-border/50 pt-8">
                <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                  {copy.other}
                </span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {siblings.map((sibling) => (
                    <Link
                      key={sibling.slug}
                      href={`/legal/${sibling.slug}`}
                      className="rounded-full border border-border/70 bg-background/60 px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
                    >
                      {sibling.label[locale]}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          </motion.div>
        </Container>
      </section>
    </main>
  );
}
