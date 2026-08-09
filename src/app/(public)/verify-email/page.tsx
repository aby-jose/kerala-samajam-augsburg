"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyEmail } from "@/lib/auth-actions";
import { Container } from "@/components/layout/container";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    const performVerification = async () => {
      try {
        const result = await verifyEmail(token);
        if (result.success) {
          setStatus("success");
          setMessage("Your email has been successfully verified! You can now access your member portal.");
        } else {
          setStatus("error");
          setMessage(result.error || "Failed to verify email.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("An unexpected error occurred.");
      }
    };

    performVerification();
  }, [token]);

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/5 pt-40 pb-20">
      <Container className="max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-[2.5rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden"
        >
          {/* Background Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -ml-16 -mb-16" />

          <div className="relative z-10 space-y-8">
            <div className="flex justify-center">
               <div className="h-24 w-24 rounded-3xl bg-secondary/30 flex items-center justify-center relative">
                  {status === "loading" && <Loader2 className="w-12 h-12 animate-spin text-primary" />}
                  {status === "success" && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle className="w-12 h-12 text-emerald-500" />
                    </motion.div>
                  )}
                  {status === "error" && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <XCircle className="w-12 h-12 text-red-500" />
                    </motion.div>
                  )}
                  <ShieldCheck className="absolute -bottom-2 -right-2 w-8 h-8 text-primary/40" />
               </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-serif tracking-tight">
                {status === "loading" && "Account Verification"}
                {status === "success" && "Verified Successfully"}
                {status === "error" && "Verification Failed"}
              </h1>
              <p className="text-muted-foreground text-lg font-light leading-relaxed">
                {message}
              </p>
            </div>

            {status !== "loading" && (
              <div className="pt-4">
                <Button 
                  onClick={() => router.push("/?auth=login")}
                  className="h-14 px-10 rounded-2xl bg-primary text-white font-bold uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-primary/20 transition-all flex items-center gap-3 mx-auto"
                >
                  {status === "success" ? "Continue to Sign In" : "Try Again"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </main>
  );
}

// useSearchParams() opts the route into client-side rendering, so it needs a
// Suspense boundary or the production build fails to prerender this page.
export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center bg-background">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
