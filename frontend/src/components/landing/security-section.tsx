import Link from "next/link";
import { Trash2, Lock, ShieldCheck, EyeOff, ArrowRight, type LucideIcon } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { SECURITY_FEATURES } from "@/lib/site-config";

const iconMap: Record<string, LucideIcon> = {
  trash: Trash2,
  lock: Lock,
  shield: ShieldCheck,
  "eye-off": EyeOff,
};

export function SecuritySection() {
  return (
    <section id="security" className="relative overflow-hidden py-16 sm:py-24">
      {/* Backdrop: faint grid + gradient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute right-[-6%] top-1/4 h-80 w-80 rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute left-[-4%] bottom-1/4 h-72 w-72 rounded-full bg-secondary/15 blur-[120px]" />
      </div>

      <Container size="wide">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: heading + copy + CTA */}
          <div className="flex flex-col gap-7">
            <SectionHeading
              align="left"
              eyebrow="Security & privacy"
              title={
                <>
                  Your files are <span className="text-gradient">safe</span> with us
                </>
              }
              description="Privacy isn't an afterthought — it's built into every step. Your files are encrypted in transit, isolated at rest, and erased automatically."
            />

            <Reveal delay={0.1}>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                We process millions of files without ever holding on to a single one longer than
                needed. No tracking, no data mining, no surprises — just fast, secure tools you can
                trust with your most sensitive documents.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <Button asChild variant="outline" size="lg">
                <Link href="/#faq">
                  Learn more <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Reveal>
          </div>

          {/* Right: 2x2 feature grid */}
          <div className="grid gap-5 sm:grid-cols-2">
            {SECURITY_FEATURES.map((feature, index) => {
              const Icon = iconMap[feature.icon] ?? ShieldCheck;
              return (
                <Reveal
                  key={feature.title}
                  direction="up"
                  delay={index * 0.08}
                  className="h-full"
                >
                  <div className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient bg-[length:200%_200%] text-white shadow-glow transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
