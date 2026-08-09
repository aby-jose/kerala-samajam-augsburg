"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock as LockIcon, 
  ArrowRight as ArrowRightIcon, 
  Loader2 as Loader2Icon, 
  CheckCircle2 as CheckCircle2Icon, 
  ShieldAlert as ShieldAlertIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { resetPassword } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await resetPassword(token, password);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2Icon className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="font-sans text-3xl font-extrabold tracking-[-0.035em] text-foreground">Password Updated</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Your new password is saved. We are taking you back to sign in now.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-10 space-y-3">
        <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform">
          <LockIcon className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-sans text-4xl font-extrabold leading-[1.06] tracking-[-0.04em] text-foreground">Set a New Password</h1>
        <p className="mt-3 text-sm text-muted-foreground">Choose something you have not used elsewhere, and you are back in.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20 flex items-center gap-3 text-xs font-bold text-destructive">
            <ShieldAlertIcon className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">New Password</label>
            <div className="relative">
              <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-14 pl-12 pr-4 bg-secondary/30 border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-sm transition-all text-foreground shadow-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</label>
            <div className="relative">
              <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full h-14 pl-12 pr-4 bg-secondary/30 border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none rounded-2xl text-sm transition-all text-foreground shadow-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={loading || !token} 
          className="w-full h-14 rounded-2xl font-bold shadow-xl shadow-primary/20"
        >
          {loading ? <Loader2Icon className="h-5 w-5 animate-spin" /> : (
            <span className="flex items-center gap-2">
              Update Password <ArrowRightIcon className="h-5 w-5" />
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center bg-background py-20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
      </div>
      
      <Container className="relative z-10">
        <Suspense fallback={<div className="flex justify-center"><Loader2Icon className="h-10 w-10 animate-spin text-primary" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </Container>
    </main>
  );
}
