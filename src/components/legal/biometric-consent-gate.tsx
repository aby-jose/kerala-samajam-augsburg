"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Fingerprint,
  Loader2,
  Lock,
  MonitorSmartphone,
  ScanFace,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConsentCheckbox, LegalLink } from "@/components/legal/consent-checkbox";
import {
  getBiometricConsentStatus,
  grantBiometricConsent,
} from "@/lib/privacy-actions";
import { getErrorMessage } from "@/lib/utils";

/**
 * Art. 9 GDPR gate for the gallery face search.
 *
 * Face templates are biometric data used to identify a person, so they are a
 * special category and need *explicit* consent under Art. 9(2)(a) — obtained
 * on its own, in plain words, and never bundled with agreement to the privacy
 * policy as a whole. That is why this is a separate screen rather than a line
 * in the terms.
 *
 * Children only render once consent is on record.
 */

const POINTS = [
  {
    icon: MonitorSmartphone,
    title: "Your selfie never leaves your device",
    body: "The reference photo you upload or take is analysed in your browser. It is not uploaded to us and is not stored anywhere.",
  },
  {
    icon: ScanFace,
    title: "What is compared, and what is stored",
    body: "Faces in gallery photos are reduced to a numeric descriptor so they can be matched. Those descriptors are biometric data, and they are deleted with the photo they came from.",
  },
  {
    icon: Trash2,
    title: "You can take it back at any time",
    body: "Withdrawing under Privacy & consent in your profile deletes your face profile straight away. Withdrawing is as easy as giving consent.",
  },
  {
    icon: Lock,
    title: "One extra connection",
    body: "The recognition models are fetched from a public code repository (GitHub), which necessarily sees your IP address.",
  },
];

export function BiometricConsentGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [granted, setGranted] = React.useState<boolean | null>(null);
  const [accepted, setAccepted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (status !== "authenticated") {
      setGranted(status === "loading" ? null : false);
      return;
    }

    getBiometricConsentStatus()
      .then((result) => {
        if (!cancelled) setGranted(result.granted);
      })
      .catch(() => {
        if (!cancelled) setGranted(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleGrant = async () => {
    if (!accepted) {
      setError("Please tick the box to give your explicit consent.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await grantBiometricConsent();
      setGranted(true);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your consent. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  if (granted === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (granted) return <>{children}</>;

  // Consent has to be attributable to a person to be evidence of anything, so
  // signing in comes first.
  if (status !== "authenticated") {
    return (
      <Notice
        title="Sign in to use face search"
        body="Face recognition rests on your explicit consent, and we can only record that against an account. Please sign in first."
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-2xl space-y-8 py-4"
    >
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600">
          <Fingerprint className="h-6 w-6" />
        </div>

        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Art. 9 GDPR · special category
          </span>
        </span>

        <h3 className="mt-5 font-sans text-2xl font-extrabold tracking-[-0.035em] text-foreground">
          Before we look for{" "}
          <span className="font-serif font-normal italic tracking-[-0.015em] text-primary">
            your face
          </span>
        </h3>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Recognising a face means processing biometric data. German and EU law
          treat that as sensitive, so it happens only if you say yes here —
          separately from everything else you have agreed to.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {POINTS.map((point) => (
          <div
            key={point.title}
            className="rounded-2xl border border-border/60 bg-muted/20 p-5"
          >
            <point.icon className="h-4 w-4 text-primary/60" />
            <h4 className="mt-3 text-[13px] font-bold tracking-[-0.01em] text-foreground">
              {point.title}
            </h4>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {point.body}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-border/60 bg-background p-5">
        <ConsentCheckbox
          checked={accepted}
          onChange={(value) => {
            setAccepted(value);
            if (value) setError(null);
          }}
          error={error}
        >
          I give my <strong className="font-semibold text-foreground">explicit consent</strong>{" "}
          under Art. 9(2)(a) GDPR to the processing of my biometric data for the
          purpose of finding photos of me, as described in the{" "}
          <LegalLink slug="privacy">Privacy Policy</LegalLink>.
        </ConsentCheckbox>

        <Button
          onClick={handleGrant}
          disabled={isSaving || !accepted}
          className="h-11 w-full rounded-xl text-[10px] font-bold uppercase tracking-[0.18em] shadow-lg shadow-primary/20"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consent and continue"}
        </Button>

        <p className="text-center text-[10px] leading-relaxed text-muted-foreground/70">
          You can withdraw this at any time under{" "}
          <Link
            href="/profile"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2"
          >
            Privacy &amp; consent
          </Link>{" "}
          in your profile.
        </p>
      </div>
    </motion.div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-sans text-lg font-extrabold tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
