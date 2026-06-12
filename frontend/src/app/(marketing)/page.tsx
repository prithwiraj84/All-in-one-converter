import { Hero } from "@/components/landing/hero";
import { StatsSection } from "@/components/landing/stats-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ShowcaseSection } from "@/components/landing/showcase-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { SecuritySection } from "@/components/landing/security-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { JsonLd, softwareAppSchema, faqSchema } from "@/components/seo/structured-data";
import { FAQS, SITE } from "@/lib/site-config";

// Force static rendering so the full marketing content is baked into the
// initial HTML — SEO crawlers must not receive a streamed "Loading…" shell.
export const dynamic = "force-static";

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          softwareAppSchema({ name: SITE.name, description: SITE.description, url: SITE.url }),
          faqSchema(FAQS),
        ]}
      />
      <Hero />
      <StatsSection />
      <FeaturesSection />
      <ShowcaseSection />
      <HowItWorksSection />
      <SecuritySection />
      <PricingSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
