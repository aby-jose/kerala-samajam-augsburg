"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useConfig } from "@/components/providers/config-provider";
import { getNewCaptcha } from "@/lib/auth-actions";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  captchaCode: z.string().min(1, "Enter the code shown above"),
  // Honeypot — left blank by a human, filled in by a script that fills every
  // field it finds. Not validated here (a visible error would give it away);
  // checked in onSubmit and again on the server.
  website: z.string().optional(),
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [captcha, setCaptcha] = useState<{ id: string; code: string } | null>(null);

  const searchParams = useSearchParams();
  const isLogout = searchParams.get("logout") === "true";

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "ADMIN" && !isLogout) {
      router.push("/admin/dashboard");
    }
  }, [status, session, router, isLogout]);

  const refreshCaptcha = async () => {
    const data = await getNewCaptcha();
    setCaptcha(data);
    setValue("captchaCode", "");
  };

  // Fetched fresh whenever the login form comes into view — on mount, and
  // again coming back from "forgot password" — rather than server-rendered:
  // the code has to match whatever the database handed out for this session,
  // so it can only come from a client call. A code left over from minutes ago
  // spent on the reset flow would just expire and fail anyway.
  useEffect(() => {
    if (view === "login") refreshCaptcha();
  }, [view]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    // Bot filled the honeypot — say nothing useful and don't spend a captcha
    // or a rate-limit slot on it.
    if (data.website) {
      setError("Invalid email or password.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("admin-credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
        captchaId: captcha?.id,
        captchaCode: data.captchaCode,
      }, {
        // @ts-ignore
        basePath: "/api/admin/auth"
      });

      if (result?.error) {
        setError(result.error);
        refreshCaptcha();
      } else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      refreshCaptcha();
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
      "bg-white text-zinc-900 placeholder:text-zinc-400 autofill:shadow-[inset_0_0_0_1000px_#ffffff]",
      hasError ? "border-red-500/60" : "border-zinc-300"
    );

  const labelClasses = "text-sm font-medium text-zinc-700";
  const linkClasses =
    "text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900";
  const fieldErrorClasses = "mt-1 text-xs text-red-600";

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
      className="w-full max-w-4xl"
    >
      <div className="relative flex w-full flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.06),0_32px_64px_-24px_rgba(0,0,0,0.25)] md:min-h-[540px] md:flex-row">
        {/* Left pane — brand, not a photo. Kept dark for contrast against the
            light form pane, same as the rest of the site does for its one
            deliberately dark band (footer/CTA), not because there's a dark
            theme to switch to. */}
        <div className="relative hidden w-[38%] shrink-0 flex-col justify-between overflow-hidden bg-surface-deep p-10 text-zinc-50 md:flex">
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
              transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
              className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/40 blur-[100px]"
            />
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-primary/30 blur-[110px]"
            />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-white/10 p-1.5 backdrop-blur-sm">
              <img src={config.branding.logoUrl || "/images/logo.png"} alt={config.siteName} className="h-full w-full object-contain" />
            </div>
            <span className="font-sans text-sm font-semibold tracking-tight text-white">{config.siteName}</span>
          </div>

          <div className="relative z-10">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
              <ShieldCheck className="h-3 w-3" /> Admin portal
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="mb-2 font-sans text-2xl font-semibold leading-tight tracking-tight text-white">
                  {view === "login" ? "Sign in to manage the site" : "Recover access to your account"}
                </h2>
                <p className="max-w-xs text-xs leading-relaxed text-white/60">
                  {view === "login"
                    ? "Restricted to committee administrators. Every sign-in is checked and rate-limited."
                    : "We'll email a reset link to the address on file — it works whether or not that address has an account."}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right pane — the form. */}
        <div className="relative flex flex-1 flex-col p-6 sm:p-10 md:p-12">
          <Link
            href="/"
            className="mb-6 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 md:absolute md:right-8 md:top-8 md:mb-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>

          <div className="flex w-full max-w-sm flex-1 flex-col justify-center self-center">
            {/* Compact header shown only where the brand pane is hidden. */}
            <div className="mb-6 flex flex-col items-center text-center md:hidden">
              <div className="mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white p-1.5">
                <img src={config.branding.logoUrl || "/images/logo.png"} alt={config.siteName} className="h-full w-full object-contain" />
              </div>
              <h1 className="font-sans text-xl font-semibold tracking-tight text-zinc-900">
                {view === "login" ? "Admin portal" : "Reset password"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {view === "login" ? `Sign in to manage ${config.siteName}` : "We'll send you a reset link."}
              </p>
            </div>

            <div className="mb-6 hidden md:block">
              <h1 className="font-sans text-xl font-semibold tracking-tight text-zinc-900">
                {view === "login" ? "Sign in" : "Reset password"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {view === "login" ? "Enter your administrator credentials." : "Enter your email and we'll send you a reset link."}
              </p>
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
                  noValidate
                >
                  {/* Honeypot: off-screen rather than display:none — some bots
                      skip visually-hidden fields, few skip ones that are merely
                      positioned off the viewport. Real users never tab to it. */}
                  <div className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input
                      id="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      {...register("website")}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className={labelClasses}>Email</Label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="username"
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
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          {...register("password")}
                          onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                          placeholder="••••••••"
                          className={cn(inputClasses(!!errors.password), "pr-10")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {capsLockOn && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                          <TriangleAlert className="h-3 w-3" /> Caps Lock is on
                        </p>
                      )}
                      {errors.password && (
                        <p className={fieldErrorClasses}>{errors.password.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="captchaCode" className={labelClasses}>Security code</Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-10 flex-1 items-center justify-center overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50">
                          <span className="select-none font-mono text-base font-bold italic tracking-[0.3em] text-zinc-700">
                            {captcha?.code || "······"}
                          </span>
                          <button
                            type="button"
                            onClick={refreshCaptcha}
                            aria-label="Get a new code"
                            className="absolute right-1.5 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          id="captchaCode"
                          type="text"
                          maxLength={6}
                          autoComplete="off"
                          {...register("captchaCode")}
                          placeholder="Code"
                          className={cn(inputClasses(!!errors.captchaCode), "w-24 text-center uppercase tracking-widest")}
                        />
                      </div>
                      {errors.captchaCode && (
                        <p className={fieldErrorClasses}>{errors.captchaCode.message}</p>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
                      autoComplete="username"
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
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
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
      </div>
    </motion.div>
  );
}
