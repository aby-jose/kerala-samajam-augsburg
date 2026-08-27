"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { getMyEmailPreferences, updateMyEmailPreferences } from "@/lib/email-preference-actions";
import { PREFERENCE_LABELS, type EmailPreferences } from "@/lib/email-preference-labels";

/**
 * Which optional email a member gets.
 *
 * Only three switches, and none of them touch transactional mail. Listing
 * tickets and receipts here as things that could be turned off would be
 * offering a choice we would then have to ignore — so the panel says plainly
 * what it does not control.
 */
export function EmailPreferencesPanel() {
  const { success, error: toastError } = useToast();
  const [prefs, setPrefs] = React.useState<EmailPreferences | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMyEmailPreferences()
      .then(setPrefs)
      .catch((e) => toastError(`Could not load preferences: ${getErrorMessage(e)}`));
  }, [toastError]);

  const toggle = async (key: keyof EmailPreferences) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setBusy(key);
    // Optimistic: a switch that waits for a round trip before moving feels
    // broken, and the failure path puts it straight back.
    setPrefs(next);
    try {
      await updateMyEmailPreferences({ [key]: next[key] });
      success(next[key] ? "Subscribed" : "Unsubscribed");
    } catch (e) {
      setPrefs(prefs);
      toastError(`Could not save: ${getErrorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-3xl border border-border/50 bg-card p-6 md:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight">Email you receive</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional messages only. You can change these whenever you like.
          </p>
        </div>
      </div>

      {!prefs ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {(Object.keys(PREFERENCE_LABELS) as Array<keyof EmailPreferences>).map((key) => (
            <li key={key} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{PREFERENCE_LABELS[key].title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {PREFERENCE_LABELS[key].description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[key]}
                aria-label={PREFERENCE_LABELS[key].title}
                onClick={() => toggle(key)}
                disabled={busy === key}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
                  prefs[key] ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    prefs[key] ? "translate-x-[22px]" : "translate-x-0.5"
                  )}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Event tickets, payment receipts, cancellation notices, password resets and anything about
        your membership are sent regardless — they are things you need in order to act, not
        marketing, so there is no switch for them.
      </p>
    </div>
  );
}
