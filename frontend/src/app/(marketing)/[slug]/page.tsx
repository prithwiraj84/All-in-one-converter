import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Upload, Cpu, Download } from "lucide-react";
import {
  ALL_TOOL_SLUGS,
  getTool,
  getCategory,
  toolsByCategory,
  FEATURED_TOOLS,
} from "@/lib/tools-registry";
import { FAQS, SITE } from "@/lib/site-config";
import { absoluteUrl } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { ToolWorkspace } from "@/components/tools/tool-workspace";
import { ToolCard } from "@/components/tools/tool-card";
import { AdUnit } from "@/components/ads/ad-unit";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  JsonLd,
  softwareAppSchema,
  faqSchema,
  breadcrumbSchema,
} from "@/components/seo/structured-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_TOOL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  const url = absoluteUrl(`/${tool.slug}`);
  return {
    title: tool.seo.title,
    description: tool.seo.description,
    keywords: tool.seo.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: tool.seo.title,
      description: tool.seo.description,
      url,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: tool.seo.title, description: tool.seo.description },
  };
}

const STEPS = [
  { icon: Upload, title: "Upload your file", text: "Drag & drop or browse — your file uploads over an encrypted connection." },
  { icon: Cpu, title: "We process it", text: "Our optimized engine does the work in seconds, right in the cloud." },
  { icon: Download, title: "Download the result", text: "Grab your file instantly. We delete it automatically afterwards." },
];

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  const category = getCategory(tool.category);
  const related = toolsByCategory(tool.category)
    .filter((t) => t.slug !== tool.slug)
    .concat(FEATURED_TOOLS.filter((t) => t.category !== tool.category))
    .slice(0, 4);

  const toolFaqs = [
    ...(tool.faqs ?? []),
    {
      question: `Is ${tool.title} free to use?`,
      answer: `Yes — ${tool.title} is completely free with generous daily limits. No signup or watermark required.`,
    },
    {
      question: "Are my files safe?",
      answer:
        "Absolutely. Files are transferred over encrypted TLS connections and deleted automatically within 60 minutes. We never share or sell your data.",
    },
    ...FAQS.slice(0, 2),
  ];

  return (
    <>
      <JsonLd
        data={[
          softwareAppSchema({
            name: tool.title,
            description: tool.seo.description,
            url: absoluteUrl(`/${tool.slug}`),
          }),
          faqSchema(toolFaqs),
          breadcrumbSchema([
            { name: "Home", url: SITE.url },
            { name: "Tools", url: absoluteUrl("/tools") },
            { name: tool.title, url: absoluteUrl(`/${tool.slug}`) },
          ]),
        ]}
      />

      {/* Hero + workspace */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.08] blur-3xl" />
          <div className="absolute inset-0 bg-grid opacity-[0.4]" />
        </div>

        <Container size="wide" className="py-12 lg:py-16">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <Link href="/tools" className="hover:text-foreground">Tools</Link>
            <span>/</span>
            <span className="text-foreground">{tool.title}</span>
          </nav>

          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Reveal direction="right" className="lg:pt-6">
              <Badge variant="outline" className="mb-4">
                <span className={category.accent}>●</span> {category.label}
              </Badge>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                {tool.title}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">{tool.longDescription}</p>

              <ul className="mt-6 space-y-3">
                {[
                  "100% free with no watermark",
                  "Secure, encrypted processing",
                  "Files auto-deleted after 60 minutes",
                  "Works on any device",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Trusted by 50,000+ users · 1M+ files processed
              </div>
            </Reveal>

            <Reveal direction="left">
              <ToolWorkspace slug={tool.slug} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface/50 py-16">
        <Container size="wide">
          <Reveal className="mx-auto mb-10 max-w-xl text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              How to {tool.title.toLowerCase()}
            </h2>
            <p className="mt-2 text-muted-foreground">Three simple steps. No software to install.</p>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.1}>
                <div className="relative rounded-2xl border border-border bg-card p-6 shadow-card">
                  <span className="absolute right-5 top-5 font-display text-4xl font-bold text-muted/60">
                    {i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* In-content ad (free/consented users only) */}
      <Container size="wide" className="pt-10">
        <AdUnit minHeight={110} />
      </Container>

      {/* FAQ */}
      <section className="py-16">
        <Container size="narrow">
          <Reveal className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
          </Reveal>
          <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-6">
            {toolFaqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className={i === toolFaqs.length - 1 ? "border-b-0" : ""}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Container>
      </section>

      {/* Related tools */}
      <section className="border-t border-border bg-surface/50 py-16">
        <Container size="wide">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Related tools</h2>
            <Link href="/tools" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              All tools <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
