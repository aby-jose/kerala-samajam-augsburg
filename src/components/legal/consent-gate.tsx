"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  FileText,
  Loader2,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { acceptConsents, getPendingConsents } from "@/lib/legal-actions";
import { LegalSlug, PendingConsent } from "@/lib/legal-schema";
import { cn, getErrorMessage } from "@/lib/utils";

/**
 * Re-consent gate.
 *
 * When a consent-bearing document is published at a new version, every member
 * whose last acceptance is behind is asked again — shown what changed, with
 * one unticked box per document. Boxes are never pre-ticked: consent has to
 * be a positive act (Art. 4 (11) GDPR, *Planet49*, C-673/17).
 *
 * The modal can be set aside once per session, because locking someone out of
 * their own account data would itself be a problem. What it does not allow is
 * completing a new paid transaction — forms call `useLegalConsent()` and block
 * on `hasPending` until the member has accepted.
 */

interface ConsentContextValue {
  pending: PendingConsent[];
  hasPending: boolean;
  isLoading: boolean;
  /** Reopen the modal — used by forms that refuse to submit while pending. */
  promptConsent: () => void;
  refresh: () => Promise<void>;
}

const ConsentContext = React.createContext<ConsentContextValue>({
  pending: [],
  hasPending: false,
  isLoading: true,
  promptConsent: () => {},
  refresh: async () => {},
});

export const useLegalConsent = () => React.useContext(ConsentContext);

const DEFERRED_KEY = "ksa_consent_deferred";

export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [pending, setPending] = React.useState<PendingConsent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isOpen, setIsOpen] = React.useState(false);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (status !== "authenticated") {
      setPending([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await getPendingConsents();
      setPending(result);
      setChecked({});

      if (result.length > 0) {
        const deferred = sessionStorage.getItem(DEFERRED_KEY);
        setIsOpen(deferred !== "1");
      } else {
        setIsOpen(false);
        sessionStorage.removeItem(DEFERRED_KEY);
      }
    } catch (err) {
      // A failure here must not block the site; the member is simply not
      // prompted this time round.
      console.error("Failed to check pending consents:", err);
      setPending([]);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    load();
  }, [load]);

  const allChecked = pending.length > 0 && pending.every((doc) => checked[doc.slug]);

  const handleAccept = async () => {
    if (!allChecked) {
      setError("Please confirm each document to continue.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await acceptConsents(
        pending.map((doc) => doc.slug),
        "reconsent"
      );
      sessionStorage.removeItem(DEFERRED_KEY);
      setPending([]);
      setIsOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your choice. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefer = () => {
    sessionStorage.setItem(DEFERRED_KEY, "1");
    setIsOpen(false);
  };

  const value = React.useMemo<ConsentContextValue>(
    () => ({
      pending,
      hasPending: pending.length > 0,
      isLoading,
      promptConsent: () => setIsOpen(true),
      refresh: load,
    }),
    [pending, isLoading, load]
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}

      {/* Quiet reminder once the modal has been set aside for this session. */}
      <AnimatePresence>
        {pending.length > 0 && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-0 z-150 p-3 sm:p-4"
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-50/95 px-5 py-3.5 text-left shadow-lg backdrop-blur-md transition-colors hover:bg-amber-50"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="flex-1 text-xs font-medium leading-relaxed text-amber-900">
                We have updated our terms. Please review and accept them to keep
                registering for events and managing your membership.
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                Review
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && pending.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-200 bg-black/40 backdrop-blur-md"
            />

            <div className="pointer-events-none fixed inset-0 z-200 flex flex-col overflow-y-auto p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="consent-gate-title"
                className="pointer-events-auto relative mx-auto my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-background shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)] sm:rounded-4xl"
              >
                {/* Header band — the dark surface used across the site */}
                <div className="relative overflow-hidden bg-surface-deep px-8 py-9 text-center sm:px-12">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                      backgroundSize: "22px 22px",
                    }}
                  />
                  <div className="relative">
                    <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                        Updated terms
                      </span>
                    </span>

                    <h2
                      id="consent-gate-title"
                      className="mt-5 font-sans text-2xl font-extrabold tracking-[-0.035em] text-white sm:text-3xl"
                    >
                      Something has{" "}
                      <span className="font-serif font-normal italic tracking-[-0.015em] text-primary">
                        changed
                      </span>
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-white/60">
                      {pending.length === 1
                        ? "We have published a new version of one of our documents. Please take a moment to read what changed."
                        : `We have published new versions of ${pending.length} documents. Please take a moment to read what changed.`}
                    </p>
                  </div>
                </div>

                <div className="max-h-[52vh] space-y-4 overflow-y-auto px-6 py-7 sm:px-10">
                  {pending.map((doc) => (
                    <ConsentRow
                      key={doc.slug}
                      doc={doc}
                      checked={!!checked[doc.slug]}
                      onToggle={(value) =>
                        setChecked((prev) => ({ ...prev, [doc.slug]: value }))
                      }
                    />
                  ))}

                  <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                    You can withdraw consent at any time under{" "}
                    <Link
                      href="/profile"
                      className="font-medium text-primary underline decoration-primary/30 underline-offset-4"
                    >
                      Privacy &amp; consent
                    </Link>{" "}
                    in your profile.
                  </p>
                </div>

                <div className="space-y-3 border-t border-border/60 bg-muted/20 px-6 py-6 sm:px-10">
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-center gap-2 text-[11px] font-semibold text-destructive"
                      >
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    onClick={handleAccept}
                    disabled={isSaving || !allChecked}
                    className="h-12 w-full rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-primary/20"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Accept and continue
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={handleDefer}
                    disabled={isSaving}
                    className="w-full text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Not right now — remind me later
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </ConsentContext.Provider>
  );
}

function ConsentRow({
  doc,
  checked,
  onToggle,
}: {
  doc: PendingConsent;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        checked ? "border-primary/40 bg-primary/[0.04]" : "border-border/60 bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/60" />
            <h3 className="truncate font-sans text-sm font-bold tracking-[-0.02em] text-foreground">
              {doc.title.en}
            </h3>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              v{doc.version}
            </span>
          </div>

          {doc.acceptedVersion !== null && (
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              You previously accepted version {doc.acceptedVersion}.
            </p>
          )}
        </div>

        <Link
          href={`/legal/${doc.slug}`}
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          Read
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {doc.changeNote && (
        <div className="mt-4 flex gap-2.5 rounded-xl border border-border/50 bg-background/60 p-3.5">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/50" />
          <div className="min-w-0">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
              What changed
            </span>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {doc.changeNote}
            </p>
          </div>
        </div>
      )}

      {/* Never pre-ticked — consent has to be a deliberate act. */}
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-all",
            checked ? "border-primary bg-primary" : "border-border bg-background"
          )}
        >
          {checked && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="sr-only"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          I have read and accept the{" "}
          <span className="font-semibold text-foreground">{doc.title.en}</span> (version{" "}
          {doc.version}).
        </span>
      </label>
    </div>
  );
}

/**
 * Inline notice for forms that will not submit while a re-consent is pending.
 * Keeps the reason visible at the point of failure instead of silently
 * disabling a button.
 */
export function ConsentBlockedNotice({ className }: { className?: string }) {
  const { hasPending, promptConsent } = useLegalConsent();
  if (!hasPending) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4",
        className
      )}
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 space-y-2">
        <p className="text-xs leading-relaxed text-amber-900">
          Our terms have been updated. Please accept the new version before
          continuing with a paid action.
        </p>
        <button
          type="button"
          onClick={promptConsent}
          className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 underline underline-offset-4 hover:text-amber-800"
        >
          Review now
        </button>
      </div>
    </div>
  );
}

export type { LegalSlug };
