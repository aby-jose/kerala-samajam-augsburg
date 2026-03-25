"use client";

import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (result?.error) {
        setError("Invalid credentials.");
      } else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Authentication error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[420px]"
    >
      {/* Dual Theme Glass Card: Guaranteed by JS State rendering distinct Tailwind classes */}
      <div className={`backdrop-blur-xl relative overflow-hidden transition-colors duration-500 rounded-2xl p-10 md:p-14 ${isDark ? 'bg-black/70 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]' : 'bg-white/80 border border-white/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]'}`}>
        
        {/* Subtle Internal Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-[60px] opacity-50 pointer-events-none" />
        
        <div className="relative z-10 space-y-10">
          {/* Header */}
          <div className="space-y-4 text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-2 shadow-sm transition-colors duration-500 ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-primary/5 border border-primary/10 text-primary'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className={`text-2xl font-bold tracking-tight transition-colors duration-500 ${isDark ? 'text-white' : 'text-zinc-900'}`}>Admin Portal</h1>
              <p className={`text-[13px] font-medium transition-colors duration-500 ${isDark ? 'text-white/40' : 'text-zinc-500'}`}>Verify credentials for institutional access</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest pl-1 transition-colors duration-500 ${isDark ? 'text-white/30' : 'text-zinc-500'}`}>
                  Email Address
                </Label>
                <input
                  type="email"
                  {...register("email")}
                  placeholder="admin@ksaugsburg.de"
                  className={`w-full h-12 rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all duration-500 ${isDark ? 'bg-black/40 text-white placeholder:text-white/20' : 'bg-white/60 text-zinc-900 placeholder:text-zinc-400'} ${errors.email ? 'border border-red-500/50' : isDark ? 'border border-white/10' : 'border border-zinc-200'}`}
                />
                <AnimatePresence mode="wait">
                  {errors.email && (
                    <motion.p 
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-red-400 flex items-center gap-1.5 pl-1 font-bold uppercase tracking-tight mt-1"
                    >
                      <AlertCircle className="w-3 h-3" /> {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest pl-1 transition-colors duration-500 ${isDark ? 'text-white/30' : 'text-zinc-500'}`}>
                  Access Key
                </Label>
                <input
                  type="password"
                  {...register("password")}
                  placeholder="••••••••"
                  className={`w-full h-12 rounded-lg px-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all duration-500 ${isDark ? 'bg-black/40 text-white placeholder:text-white/20' : 'bg-white/60 text-zinc-900 placeholder:text-zinc-400'} ${errors.password ? 'border border-red-500/50' : isDark ? 'border border-white/10' : 'border border-zinc-200'}`}
                />
                <AnimatePresence mode="wait">
                  {errors.password && (
                    <motion.p 
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-red-400 flex items-center gap-1.5 pl-1 font-bold uppercase tracking-tight mt-1"
                    >
                      <AlertCircle className="w-3 h-3" /> {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold p-4 rounded-xl text-center uppercase tracking-widest"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 rounded-lg bg-primary hover:opacity-90 text-white font-bold uppercase tracking-[0.2em] text-[10px] transition-all relative overflow-hidden shadow-lg shadow-primary/20 mt-4"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
