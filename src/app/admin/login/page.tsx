"use client";

import React from "react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
        setError("Invalid email or password");
      } else {
        router.push("/admin/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full border-none shadow-2xl">
        <CardHeader className="space-y-1 text-center pb-8 pt-10">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10 px-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...register("email")} placeholder="admin@ksaugsburg.de" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base font-bold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
