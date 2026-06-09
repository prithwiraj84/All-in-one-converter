import { Cpu, Download, UploadCloud, type LucideIcon } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOW_IT_WORKS } from "@/lib/site-config";

const iconMap: Record<string, LucideIcon> = {
  upload: UploadCloud,
  cpu: Cpu,
  download: Download,
};

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden py-20 sm:py-24">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute left-1/2 top-1/3 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.07] blur-[120px]" />
      </div>

      <Container size="wide">
        <SectionHeading
          eyebrow="How it works"
          title={
            <>
              Three simple steps to{" "}
              <span className="text-gradient">transform any file</span>
            </>
          }
          description="No installs, no friction. From upload to download in seconds — your files are handled fast, securely and then deleted."
        />

        <div className="relative mt-16">
          {/* Connecting line — horizontal on md+, vertical on mobile */}
          <div
            aria-hidden
            className="absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-primary via-secondary to-accent opacity-30 md:left-[12.5%] md:right-[12.5%] md:top-12 md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r"
          />

          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {HOW_IT_WORKS.map((item, index) => {
              const Icon = iconMap[item.icon] ?? UploadCloud;
              return (
                <Reveal
                  key={item.step}
                  direction="up"
                  delay={index * 0.15}
                  className="relative"
                >
                  <li className="flex items-start gap-5 md:flex-col md:items-center md:text-center">
                    {/* Numbered gradient circle */}
                    <div className="relative shrink-0">
                      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] text-xl font-bold text-white shadow-glow animate-gradient-shift">
                        {item.step}
                      </span>
                      <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-lg border border-border bg-white text-primary shadow-card">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>

                    {/* Card */}
                    <div className="flex-1 rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover md:mt-6 md:w-full">
                      <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {item.description}
                      </p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
