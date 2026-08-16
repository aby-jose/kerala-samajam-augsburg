"use client";

import { useState } from "react";
import { Loader2, Undo2 } from "lucide-react";

import { resubscribeByToken } from "@/lib/email-preference-actions";

/** The undo. See the note on the page about why the unsubscribe happens first. */
export function ResubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  if (state === "done") {
    return (
      <p className="text-sm font-semibold text-emerald-700">
        Restored — you are back on the list.
      </p>
    );
  }

  return (
    <button
      onClick={async () => {
        setState("busy");
        try {
          await resubscribeByToken(token);
          setState("done");
        } catch {
          setState("error");
        }
      }}
      disabled={state === "busy"}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
      {state === "error" ? "Try again" : "Undo — keep me subscribed"}
    </button>
  );
}
