"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { acceptInvite } from "@/lib/invite-actions";

const inputClasses = (hasError?: boolean) =>
  cn(
    "h-10 w-full rounded-xl border px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary",
    "bg-white text-zinc-900 placeholder:text-zinc-400 autofill:shadow-[inset_0_0_0_1000px_#ffffff]",
    hasError ? "border-red-500/60" : "border-zinc-300"
  );

const labelClasses = "text-sm font-medium text-zinc-700";
const fieldErrorClasses = "mt-1 text-xs text-red-600";

export function AcceptClient({
  token,
  email,
  roleName,
}: {
  token: string;
  email: string;
  roleName: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await acceptInvite(token, password);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.06),0_32px_64px_-24px_rgba(0,0,0,0.25)]">
        {success ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="font-sans text-xl font-semibold tracking-tight text-zinc-900">
              Your password is set
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              You can now sign in to the admin portal with your new password.
            </p>
            <Link href="/admin/login" className="mt-6 w-full">
              <Button type="button" className="h-10 w-full rounded-lg text-sm font-medium">
                Go to sign in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col items-center text-center">
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                <ShieldCheck className="h-3 w-3" /> Admin invitation
              </span>
              <h1 className="font-sans text-xl font-semibold tracking-tight text-zinc-900">
                Set your password
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                You have been invited as <span className="font-medium text-zinc-700">{roleName}</span>.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label className={labelClasses}>Email</Label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className={cn(inputClasses(), "cursor-not-allowed bg-zinc-100 text-zinc-500")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className={labelClasses}>New password</Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                    placeholder="••••••••"
                    required
                    className={cn(inputClasses(), "pr-10")}
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
                <p className="mt-1 text-xs text-zinc-400">At least 12 characters.</p>
                {capsLockOn && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <TriangleAlert className="h-3 w-3" /> Caps Lock is on
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className={labelClasses}>Confirm password</Label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={inputClasses()}
                />
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
                    <Loader2 className="h-4 w-4 animate-spin" /> Setting password…
                  </span>
                ) : (
                  "Set password and continue"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
