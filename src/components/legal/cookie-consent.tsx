"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Loader2, Settings2, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveCookieConsent } from "@/lib/legal-actions";
import {
  COOKIE_CONSENT_NAME,
  COOKIE_POLICY_VERSION,
  CookieCategories,
  StoredCookieConsent,
} from "@/lib/legal-schema";
import { cn } from "@/lib/utils";

/** Footer link dispatches this to reopen the panel after a choice was made. */
export const OPEN_COOKIE_SETTINGS_EVENT = "ksa:open-cookie-settings";

/** Fired after a choice is saved, so gated content can re-check. */
export const COOKIE_CONSENT_CHANGED_EVENT = "ksa:cookie-consent-changed";

/**
 * Fired whenever this banner opens or closes, with `detail.open`.
 *
 * `COOKIE_CONSENT_CHANGED_EVENT` above is not a substitute: it only fires when
 * a choice is *saved*, so the close button below — which dismisses a reopened
 * panel without saving anything — is silent. Anything that has to stay out of
 * this corner needs to hear about that dismissal too.
 */
export const COOKIE_BANNER_VISIBILITY_EVENT = "ksa:cookie-banner-visibility";

function readConsentCookie(): StoredCookieConsent | null {
  if (typeof document === "undefined") return null;

  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_CONSENT_NAME}=`))
    ?.split("=")[1];

  if (!raw) return null;

  try {
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as StoredCookieConsent;
    if (parsed.policyVersion !== COOKIE_POLICY_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read the current choice from anywhere on the client. */
export function getStoredCookieConsent(): StoredCookieConsent | null {
  return readConsentCookie();
}

const CATEGORY_COPY = [
  {
    key: "essential" as const,
    title: "Strictly necessary",
    description:
      "Signing in, protecting forms against cross-site attacks, and remembering this very choice. The site cannot work without them, so they are exempt from consent under § 25 (2) TDDDG.",
    locked: true,
  },
  {
    key: "functional" as const,
    title: "Functional",
    description:
      "Remembers preferences such as your language on the legal pages. Convenience only — nothing is shared with anyone.",
    locked: false,
  },
  {
    key: "media" as const,
    title: "Gallery media",
    description:
      "Photos and video are delivered by Cloudinary, which necessarily sees your IP address. Decline and the site still works; gallery media then loads only when you confirm.",
    locked: false,
  },
];

export function CookieConsent() {
  const [open, setOpen] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [choices, setChoices] = React.useState({ functional: false, media: false });

  // Only decide whether to show the banner on the client: the cookie is what
  // determines it, and rendering it on the server would either leak into the
  // static shell or flash for people who already answered.
  React.useEffect(() => {
    const existing = readConsentCookie();
    if (!existing) {
      setOpen(true);
      return;
    }
    setChoices({
      functional: existing.categories.functional,
      media: existing.categories.media,
    });
  }, []);

  // One place to announce visibility, rather than a dispatch beside every
  // setOpen call — those drift apart the moment a new close path is added.
  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(COOKIE_BANNER_VISIBILITY_EVENT, { detail: { open } })
    );
  }, [open]);

  React.useEffect(() => {
    const reopen = () => {
      const existing = readConsentCookie();
      if (existing) {
        setChoices({
          functional: existing.categories.functional,
          media: existing.categories.media,
        });
      }
      setShowDetails(true);
      setOpen(true);
    };

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  const persist = async (categories: Partial<CookieCategories>) => {
    setIsSaving(true);
    try {
      await saveCookieConsent(categories);
      window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGED_EVENT));
      setOpen(false);
      setShowDetails(false);
    } catch (error) {
      console.error("Failed to save cookie choice:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const acceptAll = () => persist({ functional: true, media: true });
  const essentialOnly = () => persist({ functional: false, media: false });
  const saveSelection = () => persist(choices);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 right-0 z-200 w-full max-w-[30rem] p-3 sm:p-4"
          role="dialog"
          aria-modal="false"
          aria-label="Cookie settings"
        >
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/95 shadow-[0_20px_56px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Cookie className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-sans text-[15px] font-extrabold tracking-[-0.03em] text-foreground">
                        Your choice about cookies
                      </h2>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        We use only what the site needs, plus optional extras. No
                        tracking, no advertising, no profiling — so{" "}
                        <span className="font-semibold text-foreground">
                          essential only
                        </span>{" "}
                        works fully.{" "}
                        <Link
                          href="/legal/cookies"
                          className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                        >
                          Cookies
                        </Link>{" "}
                        ·{" "}
                        <Link
                          href="/legal/privacy"
                          className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                        >
                          Privacy
                        </Link>
                      </p>
                    </div>

                    {readConsentCookie() && (
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {showDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 max-h-[38vh] divide-y divide-border/60 overflow-y-auto rounded-2xl border border-border/60 bg-muted/20">
                          {CATEGORY_COPY.map((category) => (
                            <div
                              key={category.key}
                              className="flex items-start justify-between gap-3 p-3.5"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h3 className="text-xs font-semibold text-foreground">
                                    {category.title}
                                  </h3>
                                  {category.locked && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-primary">
                                      <ShieldCheck className="h-2 w-2" />
                                      Always on
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] leading-relaxed text-muted-foreground">
                                  {category.description}
                                </p>
                              </div>

                              <Switch
                                checked={
                                  category.locked
                                    ? true
                                    : choices[category.key as "functional" | "media"]
                                }
                                disabled={category.locked}
                                onCheckedChange={(value) =>
                                  setChoices((prev) => ({
                                    ...prev,
                                    [category.key]: value,
                                  }))
                                }
                                aria-label={category.title}
                                className={cn(
                                  "mt-0.5 h-5 w-9 shrink-0 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4",
                                  category.locked && "opacity-60"
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/*
                    All three on one row, and "Essential only" carries the same
                    weight as "Accept all" — refusing must not be made harder
                    than accepting.
                  */}
                  <div className="mt-4 flex items-center gap-1.5">
                    <Button
                      onClick={acceptAll}
                      disabled={isSaving}
                      className="h-9 flex-1 rounded-lg px-2 text-[9px] font-bold uppercase tracking-[0.12em] shadow-md shadow-primary/20"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Accept all"
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={essentialOnly}
                      disabled={isSaving}
                      className="h-9 flex-1 rounded-lg border-border px-2 text-[9px] font-bold uppercase tracking-[0.12em]"
                    >
                      Essential
                    </Button>

                    {showDetails ? (
                      <Button
                        variant="outline"
                        onClick={saveSelection}
                        disabled={isSaving}
                        className="h-9 flex-1 rounded-lg border-border px-2 text-[9px] font-bold uppercase tracking-[0.12em]"
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => setShowDetails(true)}
                        disabled={isSaving}
                        className="h-9 shrink-0 rounded-lg px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                        aria-label="Customise cookie settings"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
