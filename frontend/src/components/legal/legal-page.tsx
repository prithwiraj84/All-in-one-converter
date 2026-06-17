import type { ReactNode } from "react";
import { Container } from "@/components/shared/container";

/** Shared shell + typography for legal pages (Privacy, Terms). */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Container className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        {intro && <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </Container>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-10 font-display text-xl font-semibold text-foreground">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed text-muted-foreground">{children}</ul>;
}
