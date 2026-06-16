import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/components/upgrade-button";
import { PRICING_TIERS } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function PricingSection() {
  return (
    <section id="pricing" className="relative overflow-hidden py-20 sm:py-24">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.07] blur-[120px]" />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <Container size="wide">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Start free and upgrade only when you need more. No hidden fees, no surprises — cancel anytime."
        />

        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3 lg:gap-8">
          {PRICING_TIERS.map((tier, index) => {
            const highlighted = tier.highlight === true;

            const card = (
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-7 transition-all duration-300",
                  highlighted
                    ? "border-primary/40 bg-gradient-to-b from-primary/[0.06] via-card to-card shadow-glow ring-2 ring-primary md:-translate-y-2 md:scale-[1.03]"
                    : "border-border bg-card shadow-card hover:-translate-y-1 hover:shadow-card-hover",
                )}
              >
                {highlighted && (
                  <Badge
                    variant="default"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gradient bg-[length:200%_200%] px-3 py-1 text-white shadow-glow"
                  >
                    Most popular
                  </Badge>
                )}

                {/* Name */}
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {tier.name}
                </h3>

                {/* Price */}
                <div className="mt-4 flex items-end gap-1">
                  {tier.price === 0 ? (
                    <span
                      className={cn(
                        "font-display text-4xl font-bold tracking-tight sm:text-5xl",
                        highlighted ? "text-gradient" : "text-foreground",
                      )}
                    >
                      Free
                    </span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "font-display text-4xl font-bold tracking-tight sm:text-5xl",
                          highlighted ? "text-gradient" : "text-foreground",
                        )}
                      >
                        ₹{tier.price}
                      </span>
                      <span className="mb-1.5 text-sm font-medium text-muted-foreground">
                        /{tier.period}
                      </span>
                    </>
                  )}
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {tier.description}
                </p>

                {/* Features */}
                <ul className="mt-7 flex flex-1 flex-col gap-3.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
                      <CheckCircle2
                        className={cn(
                          "mt-0.5 h-5 w-5 shrink-0",
                          highlighted ? "text-primary" : "text-success",
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA — the Pro tier opens checkout; others link to signup. */}
                {tier.name === "Pro" ? (
                  <UpgradeButton plan="pro" size="lg" variant="gradient" className="mt-8 w-full">
                    {tier.cta}
                  </UpgradeButton>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    variant={highlighted ? "gradient" : "outline"}
                    className="mt-8 w-full"
                  >
                    <Link href="/signup">{tier.cta}</Link>
                  </Button>
                )}
              </div>
            );

            return (
              <Reveal
                key={tier.name}
                direction="up"
                delay={index * 0.12}
                className="flex"
              >
                {card}
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
