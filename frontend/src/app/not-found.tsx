import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-5 py-20 text-center sm:px-6">
      {/* Background glow + grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-[0.12] blur-[120px] animate-pulse-glow" />
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute left-[14%] top-[22%] h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-[12%] bottom-[18%] h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      {/* Logo */}
      <div className="mb-10">
        <Logo />
      </div>

      {/* Big gradient 404 */}
      <p className="text-gradient font-display text-[7rem] font-bold leading-none tracking-tight sm:text-[10rem]">
        404
      </p>

      {/* Heading */}
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Page not found
      </h1>

      {/* Muted text */}
      <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        Let&apos;s get you back on track.
      </p>

      {/* Buttons */}
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild variant="gradient" size="xl" className="w-full sm:w-auto">
          <Link href="/">
            Back home <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
          <Link href="/tools">
            <Compass className="h-4 w-4" /> Browse tools
          </Link>
        </Button>
      </div>
    </section>
  );
}
