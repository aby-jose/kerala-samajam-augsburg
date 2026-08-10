"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The consent tick used at every point where someone agrees to something:
 * signup, event registration, membership checkout, the contact form and the
 * biometric opt-in.
 *
 * Deliberately a plain, never-pre-ticked checkbox with the policy linked
 * inline — consent has to be a positive act, and it is only informed if the
 * document is reachable from where the box is ticked.
 */

export function ConsentCheckbox({
  checked,
  onChange,
  error,
  children,
  className,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const inputId = React.useId();
  const fieldId = id ?? inputId;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={fieldId}
        className="flex cursor-pointer items-start gap-3 text-left"
      >
        <span
          className={cn(
            "mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-all",
            checked
              ? "border-primary bg-primary"
              : error
                ? "border-destructive bg-background"
                : "border-border bg-background"
          )}
        >
          {checked && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
        </span>

        <input
          id={fieldId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          aria-invalid={!!error}
        />

        <span className="text-[11px] leading-relaxed text-muted-foreground">
          {children}
        </span>
      </label>

      {error && (
        <p className="flex items-center gap-1 pl-[30px] text-[10px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Inline link to a legal page, styled for use inside consent copy. */
export function LegalLink({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/legal/${slug}`}
      target="_blank"
      onClick={(e) => e.stopPropagation()}
      className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
    >
      {children}
    </Link>
  );
}

/** Privacy-only consent, for the contact form and event registration. */
export function PrivacyConsent({
  checked,
  onChange,
  error,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string | null;
  className?: string;
}) {
  return (
    <ConsentCheckbox checked={checked} onChange={onChange} error={error} className={className}>
      I have read the <LegalLink slug="privacy">Privacy Policy</LegalLink> and agree
      that my details will be processed to handle this request. I can withdraw this
      at any time.
    </ConsentCheckbox>
  );
}

/** Privacy + terms, for account creation. */
export function SignupConsent({
  checked,
  onChange,
  error,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string | null;
  className?: string;
}) {
  return (
    <ConsentCheckbox checked={checked} onChange={onChange} error={error} className={className}>
      I accept the <LegalLink slug="terms">Terms of Use</LegalLink> and have read the{" "}
      <LegalLink slug="privacy">Privacy Policy</LegalLink>.
    </ConsentCheckbox>
  );
}
