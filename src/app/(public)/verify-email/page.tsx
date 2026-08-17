"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { verifyEmail } from "@/lib/auth-actions";

const EASE = [0.16, 1, 0.3, 1] as const;

type Status = "checking" | "verified" | "failed";

/**
 * The page carries its state in three quiet places — the marker beside the
 * eyebrow, the italic word in the headline, and the rule under it — instead of
 * the usual icon-in-a-box. The rule is the one that does the real work: it
 * sweeps while we wait, fills on success, and stops short on failure.
 */
function VerifyEmailView({ status, reason }: { status: Status; reason?: string }) {
  const reduced = useReducedMotion();

  const rise = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, delay } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, ease: EASE, delay },
        };

  return (
    <section className="flex min-h-svh items-center bg-surface-2 pt-24 pb-20">
      <Container>
        {/* The page exists to announce a state change, so it has to announce it
            to screen readers too — not just repaint. */}
        <div className="max-w-2xl" role="status" aria-live="polite">
          {/* Eyebrow — the marker changes, the row never moves. */}
          <motion.div {...rise(0.05)} className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 items-center justify-center">
              {status === "checking" && (
                <span className="relative flex h-1.5 w-1.5">
                  {!reduced && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  )}
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              )}
              {status === "verified" && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
              {status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              {status === "checking" && "Email verification"}
              {status === "verified" && "Verified"}
              {status === "failed" && "Link not accepted"}
            </span>
          </motion.div>

          <motion.h1
            {...rise(0.15)}
            className="mt-6 text-balance font-sans text-[2.5rem] font-extrabold leading-[1.03] tracking-[-0.04em] text-foreground sm:text-[3.25rem] md:text-[3.75rem]"
          >
            {status === "checking" && (
              <>
                Checking your{" "}
                <span className="font-serif font-normal italic tracking-[-0.015em] text-primary">
                  link
                </span>
              </>
            )}
            {status === "verified" && (
              <>
                Email{" "}
                <span className="font-serif font-normal italic tracking-[-0.015em] text-primary">
                  confirmed
                </span>
              </>
            )}
            {status === "failed" && (
              <>
                This link did not{" "}
                <span className="font-serif font-normal italic tracking-[-0.015em] text-primary">
                  work
                </span>
              </>
            )}
          </motion.h1>

          {/* The signature: one hairline, three states. */}
          <motion.div
            {...rise(0.25)}
            className="relative mt-10 h-px w-full overflow-hidden bg-border"
          >
            {status === "checking" &&
              (reduced ? (
                <span className="absolute inset-y-0 left-0 w-1/3 bg-primary/60" />
              ) : (
                <motion.span
                  className="absolute inset-y-0 left-0 w-1/3 bg-primary"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
                />
              ))}
            {status === "verified" && (
              <motion.span
                className="absolute inset-0 origin-left bg-primary"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            )}
            {status === "failed" && (
              <motion.span
                className="absolute inset-y-0 left-0 w-[16%] origin-left bg-destructive/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            )}
          </motion.div>

          <motion.div
            {...rise(0.35)}
            className="mt-8 max-w-md space-y-4 text-[15px] leading-relaxed text-muted-foreground md:text-base"
          >
            {status === "checking" && <p>This takes a second. Keep the tab open while we confirm your address.</p>}
            {status === "verified" && (
              <p>
                Your address is confirmed. Sign in and your member portal is ready — events,
                registrations and your membership details all live there.
              </p>
            )}
            {status === "failed" && (
              <>
                <p className="text-foreground">{reason}</p>
                <p>
                  If you have already opened this link once, your address is confirmed and you can
                  sign in as normal. If not, get in touch and we will send you a fresh one.
                </p>
              </>
            )}
          </motion.div>

          {status !== "checking" && (
            <motion.div
              {...rise(0.45)}
              className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <Link href="/?auth=login" className="group w-full sm:w-auto">
                <Button className="h-12 w-full rounded-full px-8 text-[14px] font-bold shadow-lg shadow-primary/25 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-primary/35 sm:w-auto">
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </Button>
              </Link>

              <Link
                href={status === "verified" ? "/events" : "/contact"}
                className="rounded-full text-[14px] font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface-2"
              >
                {status === "verified" ? "See what's coming up" : "Contact us"}
              </Link>
            </motion.div>
          )}
        </div>
      </Container>
    </section>
  );
}

function VerifyEmailContent() {
  const token = useSearchParams().get("token");

  const [status, setStatus] = useState<Status>("checking");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("failed");
      setReason(
        "There is no verification token in this address. Open the link straight from the email rather than retyping it."
      );
      return;
    }

    let active = true;

    verifyEmail(token)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setStatus("verified");
          return;
        }
        setStatus("failed");
        setReason(
          result.error === "Invalid or expired verification link"
            ? "Verification links expire, and each one works only once."
            : result.error || "We could not verify this link."
        );
      })
      .catch(() => {
        if (!active) return;
        setStatus("failed");
        setReason("Something went wrong on our side while checking this link.");
      });

    return () => {
      active = false;
    };
  }, [token]);

  return <VerifyEmailView status={status} reason={reason} />;
}

// useSearchParams() opts the route into client-side rendering, so it needs a
// Suspense boundary or the production build fails to prerender this page. The
// fallback is the checking state itself, so nothing shifts once it resolves.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailView status="checking" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
