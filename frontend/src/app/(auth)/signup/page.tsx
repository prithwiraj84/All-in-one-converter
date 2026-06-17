"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, MailCheck, User, Lock, AtSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SocialButtons } from "@/components/auth/social-buttons";
import { createClient } from "@/lib/supabase/client";

const signupSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type SignupValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const [submitted, setSubmitted] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupValues) {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: window.location.origin + "/auth/callback",
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Check your email to confirm your account");
      setSubmitted(values.email);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  // Confirmation state — shown after a successful signup.
  if (submitted) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] shadow-glow animate-gradient-shift">
          <MailCheck className="h-7 w-7 text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Confirm your email
        </h1>
        <p className="mt-3 text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{submitted}</span>. Click it to
          activate your account and start converting files.
        </p>

        <div className="mt-7 rounded-xl border border-border bg-surface/70 px-4 py-3 text-left text-sm text-muted-foreground">
          <p>
            Didn&apos;t get it? Check your spam folder, or wait a minute and try again. The
            link expires after a short while.
          </p>
        </div>

        <Button asChild variant="outline" size="lg" className="mt-7 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Create your account
        </h1>
        <p className="mt-2 text-muted-foreground">Start converting files for free</p>
      </div>

      {/* Social auth */}
      <SocialButtons redirectTo="/dashboard" />

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          or sign up with email
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Email form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              className="pl-10"
              aria-invalid={!!errors.fullName}
              disabled={isSubmitting}
              {...register("fullName")}
            />
          </div>
          {errors.fullName && (
            <p className="text-xs text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-10"
              aria-invalid={!!errors.email}
              disabled={isSubmitting}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="pl-10"
              aria-invalid={!!errors.password}
              disabled={isSubmitting}
              {...register("password")}
            />
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Create account
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      {/* Sign in link */}
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
