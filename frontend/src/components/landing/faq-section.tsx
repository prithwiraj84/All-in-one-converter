import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { FAQS, SITE } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function FaqSection() {
  return (
    <section id="faq" className="relative overflow-hidden py-16 sm:py-24">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[12%] h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <Container size="narrow">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything you need to know about the platform. Can't find an answer? Reach out and we'll get back to you fast."
        />

        <div className="mt-12 rounded-2xl border border-border bg-card px-6 shadow-card">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`f-${i}`}
                className={cn(i === FAQS.length - 1 && "border-b-0")}
              >
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Still have questions */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:gap-5">
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircleQuestion className="h-4 w-4 text-primary" />
            Still have questions?
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={SITE.email ? `mailto:${SITE.email}` : "/#"}>Contact support</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
