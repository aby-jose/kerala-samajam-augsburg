"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, Landmark, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { heroSurface } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/membership-term";

/**
 * Record that money arrived.
 *
 * For a membership this is the action that starts the term, so the date is the
 * important field, not an afterthought: cash handed over at last month's event
 * has to produce the term the member actually bought. It defaults to today and
 * cannot be set in the future — a term starting tomorrow would leave the member
 * neither active nor awaiting payment.
 */

export interface RecordPaymentTarget {
  id: string;
  /** What is being paid for, shown in the header. */
  description: string;
  who: string;
  amount: number;
  method: string;
  /** Memberships start a term on this date; event fees just settle. */
  startsTerm: boolean;
}

export interface RecordPaymentValues {
  receivedOn: string;
  method: PaymentMethod;
  reference: string;
  note: string;
}

const today = () => new Date().toISOString().split("T")[0];

export default function RecordPaymentModal({
  target,
  onClose,
  onSubmit,
}: {
  target: RecordPaymentTarget;
  onClose: () => void;
  onSubmit: (values: RecordPaymentValues) => Promise<void>;
}) {
  const [receivedOn, setReceivedOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(
    target.method === PAYMENT_METHODS.CASH ? PAYMENT_METHODS.CASH : PAYMENT_METHODS.BANK_TRANSFER
  );
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError(null);

    if (!receivedOn) {
      setError("Pick the date the money arrived.");
      return;
    }
    // Checked again on the server — this is only to save a round trip.
    if (receivedOn > today()) {
      setError("The payment date cannot be in the future.");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ receivedOn, method, reference, note });
    } catch (err: any) {
      setError(err?.message || "Could not record the payment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden md:max-h-[50vh] md:max-w-[50vw]")}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3 className="font-sans text-base font-semibold text-foreground">Record payment</h3>
            <p className="truncate text-xs text-muted-foreground">
              {target.description} · {target.who}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
            <span className="text-xs font-medium text-muted-foreground">Amount received</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              €{target.amount.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="received-on">
              Date received
            </label>
            <Input
              id="received-on"
              type="date"
              max={today()}
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              className="h-10 rounded-lg"
            />
            <p className="text-xs text-muted-foreground">
              {target.startsTerm
                ? "The membership term starts on this date. Backdate it if the money arrived earlier."
                : "Backdate it if the money was collected earlier."}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Method</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod(PAYMENT_METHODS.BANK_TRANSFER)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                  method === PAYMENT_METHODS.BANK_TRANSFER
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Landmark className="h-4 w-4" /> Transfer
              </button>
              <button
                type="button"
                onClick={() => setMethod(PAYMENT_METHODS.CASH)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                  method === PAYMENT_METHODS.CASH
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Banknote className="h-4 w-4" /> Cash
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="payment-reference">
              Reference <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="payment-reference"
              placeholder={method === PAYMENT_METHODS.CASH ? "Receipt number" : "Bank statement reference"}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="h-10 rounded-lg"
            />
          </div>

          {target.startsTerm && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="payment-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="payment-note"
                placeholder="e.g. Paid in cash to the treasurer at the Onam event."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[72px] rounded-lg px-3 py-2"
              />
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-9 rounded-lg">
            Cancel
          </Button>
          <Button onClick={submit} disabled={isSaving} className="h-9 rounded-lg">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record payment
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
