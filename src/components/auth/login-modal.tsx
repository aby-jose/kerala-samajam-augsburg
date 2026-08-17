"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  registerUser,
  requestPasswordReset,
  getNewCaptcha,
} from "@/lib/auth-actions";
import { EMAIL_NOT_VERIFIED } from "@/lib/auth-gate";
import { useToast } from "@/components/ui/toast";
import { SignupConsent } from "@/components/legal/consent-checkbox";
import { RefreshCw } from "lucide-react";
import { useConfig } from "../providers/config-provider";
import { Accent } from "@/components/layout/section-heading";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthView = "login" | "signup" | "forgot-password";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.63l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
  </svg>
);

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const config = useConfig();
  const toast = useToast();
  const [view, setView] = useState<AuthView>("login");
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [captcha, setCaptcha] = useState<{ id: string; code: string } | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  // Prevent background scroll
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      refreshCaptcha();
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) refreshCaptcha();
  }, [view]);

  const refreshCaptcha = async () => {
    const data = await getNewCaptcha();
    setCaptcha(data);
    setCaptchaInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (view === "signup" && !acceptedTerms) {
      setConsentError("Please accept the Terms of Use and Privacy Policy.");
      return;
    }

    setLoading(true);
    setConsentError(null);

    try {
      if (view === "login") {
        const result = await signIn("credentials", {
          email,
          password,
          captchaId: captcha?.id,
          captchaCode: captchaInput,
          redirect: false,
        }, {
          // @ts-ignore
          basePath: "/api/auth"
        });

        if (result?.error === EMAIL_NOT_VERIFIED) {
          // The password was right; only the address is unconfirmed. Given a
          // little longer on screen than a plain failure — it carries an
          // instruction, not just a verdict.
          toast.error(`Confirm your email first — we sent a link to ${email}.`, 6000);
          refreshCaptcha();
        } else if (result?.error) {
          toast.error(result.error);
          refreshCaptcha();
        } else {
          onClose();
          onSuccess?.();
        }
      } else if (view === "signup") {
        const result = await registerUser({ 
          name, 
          email, 
          password,
          captchaId: captcha?.id,
          captchaCode: captchaInput,
          acceptedTerms,
        });
        if (result.error) {
          toast.error(result.error);
          refreshCaptcha();
        } else {
          toast.success(
            result.message || "Account created — check your email to confirm the address.",
            6000
          );
          setView("login");
          setAcceptedTerms(false);
          refreshCaptcha();
        }
      } else if (view === "forgot-password") {
        const result = await requestPasswordReset(email);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Reset link sent — check your email.", 6000);
          setEmail("");
        }
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Which OAuth providers next-auth actually registered, read from its own
  // provider list rather than duplicated as a client-side env check.
  const [enabledProviders, setEnabledProviders] = useState<{
    google: boolean;
    facebook: boolean;
  }>({ google: false, facebook: false });

  useEffect(() => {
    getProviders()
      .then((providers) => {
        setEnabledProviders({
          google: !!providers?.google,
          facebook: !!providers?.facebook,
        });
      })
      .catch(() => {
        // Leave both hidden — a button that cannot work is worse than none.
      });
  }, []);

  const handleSocialLogin = (provider: string) => {
    signIn(provider, { 
      callbackUrl: window.location.origin 
    }, {
      // @ts-ignore
      basePath: "/api/auth"
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-200 bg-black/40 backdrop-blur-md"
          />

          <div className="fixed inset-0 z-200 overflow-y-auto pointer-events-none flex flex-col">
            <div className="flex flex-1 min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-4xl bg-background rounded-3xl sm:rounded-[2.5rem] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto flex flex-col md:flex-row min-h-[480px] md:min-h-[520px] relative mx-auto my-auto"
              >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2.5 bg-muted/50 hover:bg-muted text-muted-foreground rounded-full transition-colors z-20"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Left Pane - Branding */}
              <div className="hidden md:flex flex-col justify-between w-[40%] bg-surface-deep p-8 lg:p-12 text-zinc-50 relative overflow-hidden">
                {/* Deep Animated Mesh Gradient */}
                <div className="absolute inset-0 bg-surface-deep pointer-events-none" />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                  className="absolute -top-32 -right-32 w-120 h-120 rounded-full bg-primary/40 blur-[120px] pointer-events-none"
                />
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 1 }}
                  className="absolute -bottom-32 -left-32 w-140 h-140 rounded-full bg-primary/30 blur-[140px] pointer-events-none"
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={config.branding.logoUrl || "/images/logo.png"} alt={config.siteName} className="h-10 w-auto" />
                    <span className="hidden font-sans text-lg font-extrabold tracking-[-0.03em] lg:block">{config.siteName}</span>
                  </div>
                </div>

                {/* Content Area */}
                <div className="relative z-10 mt-auto mb-2 lg:mb-4">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <h2 className="mb-4 font-sans text-3xl font-extrabold leading-[1.1] tracking-[-0.035em] text-white lg:text-4xl">
                      {view === "login" && <>Welcome <Accent>Back</Accent></>}
                      {view === "signup" && <>Create Your <Accent>Account</Accent></>}
                      {view === "forgot-password" && <>Reset Your <Accent>Password</Accent></>}
                    </h2>
                    <p className="max-w-xs text-xs leading-relaxed text-white/60 lg:text-sm">
                      {view === "login" && "Sign in to register for events, download your tickets, and manage your membership."}
                      {view === "signup" && "One account covers event registration, your tickets and your membership. Anyone can create one."}
                      {view === "forgot-password" && "Enter the email you registered with and we will send you a link to set a new password."}
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Right Pane - Form */}
              <div className="flex-1 flex flex-col py-6 sm:pt-10 px-6 sm:px-10 md:px-12 lg:px-16 bg-background relative z-10 w-full shrink-0">
                
                {/* Fixed Header Area for Tabs */}
                <div className="h-16 shrink-0 w-full flex items-start justify-center">
                  <AnimatePresence>
                    {view !== "forgot-password" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex p-1 bg-muted/40 rounded-full w-full max-w-[280px] border border-border/50"
                      >
                        <button
                          onClick={() => setView("login")}
                          className={cn(
                            "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-full transition-all relative",
                            view === "login" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {view === "login" && (
                            <motion.div layoutId="tab-pill" className="absolute inset-0 bg-background shadow-sm rounded-full z-0 border border-border/50" />
                          )}
                          <span className="relative z-10">Sign In</span>
                        </button>
                        <button
                          onClick={() => setView("signup")}
                          className={cn(
                            "flex-1 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider rounded-full transition-all relative",
                            view === "signup" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {view === "signup" && (
                            <motion.div layoutId="tab-pill" className="absolute inset-0 bg-background shadow-sm rounded-full z-0 border border-border/50" />
                          )}
                          <span className="relative z-10">Create Account</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Form Area Vertically Centered */}
                <div className="w-full max-w-[340px] mx-auto flex-1 flex flex-col justify-center pb-4 md:pb-8">

                  <div className="text-center mb-6 md:mb-8">
                    {/* Desktop Forgot Password Title */}
                    {view === "forgot-password" && (
                      <div className="hidden md:block">
                        <h3 className="mb-2 font-sans text-2xl font-extrabold tracking-[-0.03em] text-foreground">Reset Your Password</h3>
                        <p className="text-xs text-muted-foreground">We will email you a link to set a new one.</p>
                      </div>
                    )}

                    {/* Mobile Branding Header (Hidden on Desktop) */}
                    <div className="md:hidden flex flex-col items-center">
                      <img src={config.branding.logoUrl || "/images/logo.png"} alt={config.siteName} className="h-10 w-auto mb-4" />
                      <h2 className="mb-2 font-sans text-xl font-extrabold leading-tight tracking-[-0.03em] text-foreground">
                        {view === "login" && <>Welcome <Accent>Back</Accent></>}
                        {view === "signup" && <>Create Your <Accent>Account</Accent></>}
                        {view === "forgot-password" && <>Reset Your <Accent>Password</Accent></>}
                      </h2>
                      <p className="px-4 text-xs text-muted-foreground">
                        {view === "login" && "Sign in to your account."}
                        {view === "signup" && "Join Kerala Samajam Augsburg."}
                        {view === "forgot-password" && "We will email you a recovery link."}
                      </p>
                    </div>
                  </div>

                  {/*
                    Every outcome — failed sign-in, unconfirmed address, account
                    created, reset link sent — goes to a toast. Inline banners
                    pushed the form down as they appeared and shifted the whole
                    modal, and two different notice styles in one panel read as
                    two different products.
                  */}
                  <form onSubmit={handleSubmit} className="flex flex-col w-full">
                    {/* Name Input */}
                    <AnimatePresence initial={false}>
                      {view === "signup" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pb-4">
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="text"
                                placeholder="Full Name"
                                className="w-full h-12 md:h-14 pl-12 pr-4 bg-transparent border border-border/60 hover:border-foreground/30 focus:border-foreground rounded-xl text-sm transition-colors outline-none placeholder:text-muted-foreground/50"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email Input */}
                    <div className="pb-4">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="email"
                          placeholder="Email Address"
                          className="w-full h-12 md:h-14 pl-12 pr-4 bg-transparent border border-border/60 hover:border-foreground/30 focus:border-foreground rounded-xl text-sm transition-colors outline-none placeholder:text-muted-foreground/50"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <AnimatePresence initial={false}>
                      {view !== "forgot-password" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pb-4">
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <input
                                type="password"
                                placeholder="Password"
                                className="w-full h-12 md:h-14 pl-12 pr-4 bg-transparent border border-border/60 hover:border-foreground/30 focus:border-foreground rounded-xl text-sm transition-colors outline-none placeholder:text-muted-foreground/50"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Forgot Password Link */}
                    <AnimatePresence initial={false}>
                      {view === "login" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="flex justify-end pt-1 pb-5">
                            <button
                              type="button"
                              onClick={() => setView("forgot-password")}
                              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Forgot Password?
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Captcha Section */}
                    {view !== "forgot-password" && (
                      <div className="pb-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-12 md:h-14 bg-muted/30 border border-border/60 rounded-xl flex items-center justify-center relative overflow-hidden group/cap">
                             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--primary-rgb),0.05),transparent)]" />
                             <span className="text-xl font-black tracking-[0.3em] font-mono italic select-none opacity-80 group-hover/cap:scale-110 transition-transform">
                               {captcha?.code || "......"}
                             </span>
                             <button 
                               type="button"
                               onClick={refreshCaptcha}
                               className="absolute right-2 p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                             >
                               <RefreshCw className="h-4 w-4" />
                             </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Code"
                            maxLength={6}
                            className="w-24 h-12 md:h-14 px-4 bg-transparent border border-border/60 hover:border-foreground/30 focus:border-foreground rounded-xl text-center font-bold tracking-widest text-sm transition-colors outline-none placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal uppercase"
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            required
                          />
                        </div>
                        <p className="mt-2 px-1 text-[10px] text-muted-foreground">Type the code shown above to continue.</p>
                      </div>
                    )}

                    {/* The account is the basis of the contract, so agreement
                        is captured here and recorded against the version live
                        at signup. */}
                    {view === "signup" && (
                      <div className="pb-6">
                        <SignupConsent
                          checked={acceptedTerms}
                          onChange={(value) => {
                            setAcceptedTerms(value);
                            if (value) setConsentError(null);
                          }}
                          error={consentError}
                        />
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 md:h-12 rounded-xl text-xs font-bold uppercase tracking-widest group relative overflow-hidden shadow-xl shadow-primary/20 shrink-0 mt-1"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-2">
                          {view === "login" && "Sign In"}
                          {view === "signup" && "Create Account"}
                          {view === "forgot-password" && "Send Reset Link"}
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      )}
                    </Button>
                  </form>

                  {/*
                    Social sign-in, shown only for providers that are actually
                    configured. `publicAuthOptions` registers Google and
                    Facebook only when their client ids are in the environment,
                    and neither is set — so these buttons were always rendered
                    and always failed on click. Reading the live provider list
                    means they reappear on their own once the credentials are
                    added, with no code change.
                  */}
                  {view !== "forgot-password" && (enabledProviders.google || enabledProviders.facebook) && (
                    <div className="mt-8">
                      <div className="relative mb-6 text-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border/40" />
                        </div>
                        <span className="relative px-4 bg-background text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                          Or continue with
                        </span>
                      </div>

                      <div className="flex gap-3">
                        {enabledProviders.google && (
                          <button
                            type="button"
                            onClick={() => handleSocialLogin("google")}
                            aria-label="Continue with Google"
                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border/60 hover:border-foreground/30 hover:bg-muted/30 transition-all group"
                          >
                            <div className="group-hover:scale-110 transition-transform scale-90">
                              <GoogleIcon />
                            </div>
                          </button>
                        )}
                        {enabledProviders.facebook && (
                          <button
                            type="button"
                            onClick={() => handleSocialLogin("facebook")}
                            aria-label="Continue with Facebook"
                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-border/60 hover:border-foreground/30 hover:bg-muted/30 transition-all group"
                          >
                            <div className="group-hover:scale-110 transition-transform scale-90">
                              <FacebookIcon />
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {view === "forgot-password" && (
                    <div className="mt-8 text-center">
                      <button
                        onClick={() => setView("login")}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      >
                        <ArrowRight className="h-3 w-3 rotate-180" /> Back to Sign In
                      </button>
                    </div>
                  )}

                </div>
              </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
