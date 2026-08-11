"use client";

import React, { useState } from "react";
import { Check, Copy, Landmark, Banknote } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * How to pay, in one place.
 *
 * The membership modal and the profile page both need to show the amount, the
 * bank details and the reference; the reference in particular has to be
 * copyable, because a mistyped one is what turns a received payment into an
 * unmatched one an administrator cannot record.
 */

export interface PaymentInstructionsData {
  planName: string;
  amount: number;
  reference: string;
  method: string;
  bank: {
    accountHolder?: string;
    bankName?: string;
    iban?: string;
    bic?: string;
    termsDays?: number;
  };
}

function Row({
  label,
  value,
  copyable = false,
  mono = false,
}: {
  label: string;
  value?: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked in some embedded browsers; the value is on
      // screen either way, so there is nothing useful to report.
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        <span className={cn("truncate text-sm font-semibold", mono && "font-mono tracking-tight")}>
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label}`}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </span>
    </div>
  );
}

export default function PaymentInstructions({
  data,
  className,
}: {
  data: PaymentInstructionsData;
  className?: string;
}) {
  const isCash = data.method === "CASH";

  return (
    <div className={cn("rounded-2xl border border-border bg-muted/30 p-5", className)}>
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        {isCash ? (
          <Banknote className="h-4 w-4 text-primary" />
        ) : (
          <Landmark className="h-4 w-4 text-primary" />
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          {isCash ? "Paying in cash" : "Bank transfer details"}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        <Row label="Plan" value={data.planName} />
        <Row label="Amount" value={`€${data.amount.toFixed(2)}`} />
        {!isCash && (
          <>
            <Row label="Account holder" value={data.bank.accountHolder} />
            <Row label="Bank" value={data.bank.bankName} />
            <Row label="IBAN" value={data.bank.iban} copyable mono />
            <Row label="BIC" value={data.bank.bic} mono />
          </>
        )}
        <Row label="Reference" value={data.reference} copyable mono />
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {isCash ? (
          <>
            Please hand the amount to a committee member at the next meeting or event. We will
            record it and confirm by email.
          </>
        ) : (
          <>
            Please quote the reference exactly — it is how we match your transfer to your
            membership.
          </>
        )}{" "}
        <span className="font-semibold text-foreground">
          Your membership starts on the day we record your payment
        </span>{" "}
        and runs for the full term from that date.
      </p>
    </div>
  );
}
