"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Download,
  Fingerprint,
  Loader2,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  ConsentHistoryEntry,
  cancelDeletionRequest,
  exportMyData,
  getBiometricConsentStatus,
  getDeletionRequestStatus,
  getMyConsentHistory,
  grantBiometricConsent,
  requestAccountDeletion,
  withdrawBiometricConsent,
} from "@/lib/privacy-actions";
import { EmailPreferencesPanel } from "@/components/legal/email-preferences";
import { LEGAL_DOCS, isLegalSlug } from "@/lib/legal-schema";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/legal/cookie-consent";
import { cn, getErrorMessage } from "@/lib/utils";

/**
 * "Privacy & consent" in the member profile.
 *
 * Art. 12(2) GDPR obliges us to facilitate these rights rather than merely
 * describe them, and Art. 7(3) requires withdrawal to be as easy as consent.
 * So everything here is a button: see what you agreed to, withdraw the
 * biometric opt-in, download your data, ask for erasure.
 */

export function PrivacyPanel() {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  const [history, setHistory] = React.useState<ConsentHistoryEntry[]>([]);
  const [biometric, setBiometric] = React.useState<{
    granted: boolean;
    hasStoredProfile: boolean;
  } | null>(null);
  const [deletion, setDeletion] = React.useState<{ requestedAt: string | null }>({
    requestedAt: null,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [historyResult, biometricResult, deletionResult] = await Promise.all([
        getMyConsentHistory(),
        getBiometricConsentStatus(),
        getDeletionRequestStatus(),
      ]);
      setHistory(historyResult);
      setBiometric(biometricResult);
      setDeletion({ requestedAt: deletionResult.requestedAt });
    } catch (err) {
      console.error("Failed to load privacy panel:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleBiometric = async () => {
    if (!biometric) return;

    if (biometric.granted) {
      const ok = await confirm({
        title: "Withdraw face recognition consent?",
        message:
          "Your stored face profile will be deleted immediately and face search will stop working for you. You can opt in again at any time.",
        confirmText: "Withdraw consent",
        variant: "danger",
      });
      if (!ok) return;
    }

    setBusy("biometric");
    try {
      if (biometric.granted) {
        await withdrawBiometricConsent();
        success("Consent withdrawn and your face profile deleted.");
      } else {
        await grantBiometricConsent();
        success("Face recognition enabled for your account.");
      }
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, "Could not update your choice."));
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      success("Your data has been downloaded.");
    } catch (err) {
      toastError(getErrorMessage(err, "Could not prepare your export."));
    } finally {
      setBusy(null);
    }
  };

  const handleDeletion = async () => {
    if (deletion.requestedAt) {
      setBusy("deletion");
      try {
        await cancelDeletionRequest();
        success("Deletion request withdrawn.");
        await load();
      } catch (err) {
        toastError(getErrorMessage(err, "Could not withdraw the request."));
      } finally {
        setBusy(null);
      }
      return;
    }

    const ok = await confirm({
      title: "Request deletion of your account?",
      message:
        "The committee will anonymise your profile and contact details. Payment and invoice records must be kept for 10 years under German tax law (§ 147 AO, § 257 HGB) and will be retained for that purpose only. Your face profile, if any, is deleted immediately.",
      confirmText: "Request deletion",
      variant: "danger",
    });
    if (!ok) return;

    setBusy("deletion");
    try {
      await requestAccountDeletion();
      success("Your request has been recorded. The committee will be in touch.");
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, "Could not record your request."));
    } finally {
      setBusy(null);
    }
  };

  const documentConsents = React.useMemo(
    () =>
      history.filter(
        (entry) => entry.type === "DOCUMENT" && entry.slug && isLegalSlug(entry.slug)
      ),
    [history]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border/50 bg-secondary/5 py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* What you have agreed to */}
      <Card
        icon={ScrollText}
        title="What you have agreed to"
        description="Every acceptance is recorded with the exact version you were shown."
      >
        {documentConsents.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing recorded yet. Consents appear here as you accept them.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {documentConsents.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/legal/${entry.slug}`}
                    className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {LEGAL_DOCS[entry.slug as keyof typeof LEGAL_DOCS].label.en}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Version {entry.version} · accepted{" "}
                    {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · via {entry.source}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]",
                    entry.granted && !entry.revokedAt
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Check className="h-2.5 w-2.5" />
                  {entry.granted && !entry.revokedAt ? "Accepted" : "Withdrawn"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Communication preferences. Art. 7(3): withdrawing has to be as easy
          as consenting, and a switch in the profile is easier than a link at
          the bottom of an email the member may have deleted. */}
      <EmailPreferencesPanel />

      {/* Art. 9 biometric opt-in */}
      <Card
        icon={Fingerprint}
        title="Face recognition"
        description="Special-category data under Art. 9 GDPR — always your choice, never bundled with anything else."
        tone="violet"
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          Gallery face search works by computing a mathematical description of a
          face. That counts as biometric data, so it only ever happens with your
          explicit consent. Withdrawing deletes your stored profile immediately.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={handleBiometric}
            disabled={busy === "biometric"}
            variant={biometric?.granted ? "outline" : "default"}
            className="h-10 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em]"
          >
            {busy === "biometric" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : biometric?.granted ? (
              "Withdraw consent"
            ) : (
              "Enable face search"
            )}
          </Button>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]",
              biometric?.granted ? "text-emerald-700" : "text-muted-foreground"
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {biometric?.granted ? "Consent given" : "Not enabled"}
          </span>
        </div>
      </Card>

      {/* Cookies */}
      <Card
        icon={ShieldCheck}
        title="Cookie preferences"
        description="Change or withdraw the choice you made in the banner."
        tone="blue"
      >
        <Button
          variant="outline"
          onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
          className="h-10 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em]"
        >
          Open cookie settings
        </Button>
      </Card>

      {/* Access and portability */}
      <Card
        icon={Download}
        title="Your data"
        description="A copy of everything we hold about you, in a machine-readable format (Art. 15 & 20 GDPR)."
        tone="emerald"
      >
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={busy === "export"}
          className="h-10 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em]"
        >
          {busy === "export" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download my data
        </Button>
      </Card>

      {/* Erasure */}
      <Card
        icon={Trash2}
        title="Delete my account"
        description="Ask the committee to erase your account (Art. 17 GDPR)."
        tone="destructive"
      >
        <AnimatePresence mode="wait">
          {deletion.requestedAt ? (
            <motion.div
              key="requested"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-900">
                  Deletion requested on{" "}
                  {new Date(deletion.requestedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  . The committee will process it shortly. You can still change
                  your mind.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleDeletion}
                disabled={busy === "deletion"}
                className="h-10 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em]"
              >
                {busy === "deletion" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Withdraw request
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your profile and contact details will be anonymised. Payment and
                invoice records must be kept for ten years under German tax law
                (§ 147 AO, § 257 HGB) and are retained for that purpose alone.
                Any stored face profile is deleted straight away.
              </p>

              <Button
                variant="outline"
                onClick={handleDeletion}
                disabled={busy === "deletion"}
                className="h-10 rounded-xl border-destructive/30 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                {busy === "deletion" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Request deletion
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
        For anything not covered here — rectification, restriction, or an
        objection under Art. 21 — see the{" "}
        <Link
          href="/legal/privacy"
          className="font-medium text-primary underline decoration-primary/30 underline-offset-4"
        >
          Privacy Policy
        </Link>
        . You also have the right to complain to a supervisory authority.
      </p>
    </div>
  );
}

const TONE_CLASSES = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-500/10 text-blue-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  violet: "bg-violet-500/10 text-violet-600",
  destructive: "bg-destructive/10 text-destructive",
} as const;

function Card({
  icon: Icon,
  title,
  description,
  tone = "primary",
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  tone?: keyof typeof TONE_CLASSES;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/50 bg-secondary/5 p-6 shadow-xs sm:p-8">
      <header className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            TONE_CLASSES[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-sans text-base font-extrabold tracking-[-0.02em] text-foreground">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </header>

      <div className="mt-6">{children}</div>
    </section>
  );
}
