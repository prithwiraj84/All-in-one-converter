"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: FormValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/callback?next=/dashboard",
    });

    if (error) {
      toast.error(error.message || "Something went wrong. Please try again.");
      return;
    }

    setSentTo(email);
  }

  if (sentTo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success/10 text-success shadow-sm">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Check your email for a reset link
        </h1>
        <p className="mt-3 text-muted-foreground">
          We sent a password reset link to{" "}
          <span className="font-medium text-foreground">{sentTo}</span>. Follow the link to choose a
          new password.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Didn&apos;t get it? Check your spam folder or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            try a different email
          </button>
          .
        </p>

        <Button asChild variant="outline" className="mt-8 w-full">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Reset your password
        </h1>
        <p className="text-muted-foreground">
          Enter the email associated with your account and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-10"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
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
              <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </p>
    </motion.div>
  );
}
