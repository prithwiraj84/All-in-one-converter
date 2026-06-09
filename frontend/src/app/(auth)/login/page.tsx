"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButtons } from "@/components/auth/social-buttons";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/dashboard";

  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      router.push(redirectedFrom);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        {/* Heading */}
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to keep converting.
          </p>
        </div>

        {/* Social sign-in */}
        <div className="mt-6">
          <SocialButtons redirectTo={redirectedFrom} />
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            or continue with email
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Email + password form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              disabled={submitting}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              disabled={submitting}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full"
            disabled={submitting}
          >
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>

      {/* Sign-up prompt */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="h-[460px] animate-pulse rounded-2xl bg-muted/40" />}>
      <LoginForm />
    </Suspense>
  );
}
