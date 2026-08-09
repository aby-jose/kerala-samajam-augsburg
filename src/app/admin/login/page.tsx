"use client";

import React, { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useConfig } from "@/components/providers/config-provider";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const config = useConfig();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [view, setView] = useState<"login" | "forgot">("login");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const searchParams = useSearchParams();
  const isLogout = searchParams.get("logout") === "true";

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "ADMIN" && !isLogout) {
      router.push("/admin/dashboard");
    }
  }, [status, session, router, isLogout]);

  // Default to dark during SSR to prevent flash, then update immediately
  const isDark = !mounted || resolvedTheme === "dark";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("admin-credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      }, {
        // @ts-ignore
        basePath: "/api/admin/auth"
      });

      if (result?.error) {
        setError("Invalid email or password.");
      } else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResetStatus(null);
    try {
      const { requestPasswordReset } = await import("@/lib/auth-actions");
      const result = await requestPasswordReset(resetEmail);
      if (result.error) {
        setResetStatus({ type: "error", message: result.error });
      } else {
        setResetStatus({ type: "success", message: "Reset link sent. Check your email." });
      }
    } catch (err) {
      setResetStatus({ type: "error", message: "Failed to process request." });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = (hasError?: boolean) =>
    cn(
      "h-10 w-full rounded-xl border px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary",
      isDark
        ? "bg-black/40 text-white placeholder:text-white/30 autofill:shadow-[inset_0_0_0_1000px_#0a0a0a]"
        : "bg-white/70 text-zinc-900 placeholder:text-zinc-400 autofill:shadow-[inset_0_0_0_1000px_#ffffff]",
      hasError ? "border-red-500/60" : isDark ? "border-white/10" : "border-zinc-300"
    );

  const labelClasses = cn("text-sm font-medium", isDark ? "text-white/80" : "text-zinc-700");
  const linkClasses = cn(
    "text-xs font-medium transition-colors",
    isDark ? "text-white/60 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
  );
  const fieldErrorClasses = cn("mt-1 text-xs", isDark ? "text-red-400" : "text-red-600");

  if (status === "loading" || (status === "authenticated" && (session?.user as any)?.role === "ADMIN")) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className={cn(
        "w-full rounded-3xl border p-8 shadow-[0_2px_4px_rgba(0,0,0,0.08),0_32px_64px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors",
        isDark ? "border-white/10 bg-zinc-950/70" : "border-zinc-200 bg-white/85"
      )}>
        <div className="space-y-6">
          <div className="space-y-4 text-center">
            <div className={cn(
              "mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border p-1.5",
              isDark ? "border-white/10 bg-white/5" : "border-zinc-200 bg-white"
            )}>
              <img src={config.branding.logoUrl || "/images/logo.png"} alt={config.siteName} className="h-full w-full object-contain" />
            </div>
            <div className="space-y-1">
              <h1 className={cn("font-sans text-xl font-semibold tracking-tight", isDark ? "text-white" : "text-zinc-900")}>
                {view === "login" ? "Admin portal" : "Reset password"}
              </h1>
              <p className={cn("text-sm", isDark ? "text-white/60" : "text-zinc-500")}>
                {view === "login"
                  ? `Sign in to manage ${config.siteName}`
                  : "Enter your email and we'll send you a reset link."}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {view === "login" ? (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className={labelClasses}>Email</Label>
                    <input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="admin@ksaugsburg.de"
                      className={inputClasses(!!errors.email)}
                    />
                    {errors.email && (
                      <p className={fieldErrorClasses}>{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className={labelClasses}>Password</Label>
                      <button
                        type="button"
                        onClick={() => { setView("forgot"); setError(null); }}
                        className={linkClasses}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      id="password"
                      type="password"
                      {...register("password")}
                      placeholder="••••••••"
                      className={inputClasses(!!errors.password)}
                    />
                    {errors.password && (
                      <p className={fieldErrorClasses}>{errors.password.message}</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    isDark
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-red-200 bg-red-50 text-red-600"
                  )}>
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-full rounded-lg text-sm font-medium"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="forgot-form"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                onSubmit={onSubmitReset}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className={labelClasses}>Email</Label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@ksaugsburg.de"
                    required
                    className={inputClasses()}
                  />
                </div>

                {resetStatus && (
                  <div className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    resetStatus.type === "success"
                      ? isDark
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isDark
                        ? "border-red-500/30 bg-red-500/10 text-red-400"
                        : "border-red-200 bg-red-50 text-red-600"
                  )}>
                    {resetStatus.message}
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-10 w-full rounded-lg text-sm font-medium"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                      </span>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setView("login"); setResetStatus(null); }}
                    className={cn("w-full py-2 text-center", linkClasses)}
                  >
                    Back to sign in
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
