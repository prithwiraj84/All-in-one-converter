"use client";

import { Fragment, useMemo, useState } from "react";
import { CATEGORIES, toolsByCategory } from "@/lib/tools-registry";
import { searchTools } from "@/lib/tool-search";
import type { ToolCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { AdUnit } from "@/components/ads/ad-unit";
import { ToolCard } from "./tool-card";
import { SearchField } from "./tool-search";

const ACTIVE_CATEGORIES = CATEGORIES.filter((c) => toolsByCategory(c.key).length > 0);

/** The /tools listing: search + category filter over every tool. */
export function ToolsBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "all">("all");

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const hits = searchTools(query);
    return category === "all" ? hits : hits.filter((t) => t.category === category);
  }, [query, category]);

  const sections = ACTIVE_CATEGORIES.filter((c) => category === "all" || c.key === category);

  return (
    <>
      {/* Sticky search + filters (sits right under the fixed navbar). */}
      <div className="sticky top-16 z-30 border-y border-border/60 bg-background/90 backdrop-blur-xl">
        <Container size="wide" className="space-y-3 py-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search tools — e.g. compress PDF"
            inputProps={{ "aria-label": "Search tools" }}
          />
          <div
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Filter by category"
          >
            {[{ key: "all" as const, label: "All tools" }, ...ACTIVE_CATEGORIES.map((c) => ({ key: c.key, label: c.short }))].map(
              (c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={category === c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                    category === c.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ),
            )}
          </div>
        </Container>
      </div>

      {results ? (
        <section className="py-8 sm:py-12">
          <Container size="wide">
            <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
              {results.length
                ? `${results.length} tool${results.length === 1 ? "" : "s"} for “${query.trim()}”`
                : `No tools found for “${query.trim()}”.`}
            </p>
            {results.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <p className="font-medium">Try a simpler word</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  For example “compress”, “convert”, “PDF”, “image” or “video”.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                  }}
                  className="mt-4 min-h-10 rounded-lg px-4 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  Show all tools
                </button>
              </div>
            )}
          </Container>
        </section>
      ) : (
        sections.map((cat, idx) => {
          const tools = toolsByCategory(cat.key);
          const CategoryIcon = cat.icon;
          return (
            <Fragment key={cat.key}>
              <section id={cat.key} className="scroll-mt-44 border-t border-border/60 py-10 first-of-type:border-t-0 sm:py-16">
                <Container size="wide">
                  <Reveal>
                    <div className="flex items-start gap-3 sm:gap-4">
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-card sm:h-12 sm:w-12",
                          cat.gradient,
                        )}
                      >
                        <CategoryIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
                      </span>
                      <div>
                        <h2 className="font-display text-xl font-bold tracking-tight sm:text-3xl">{cat.label}</h2>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{cat.description}</p>
                      </div>
                    </div>
                  </Reveal>
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                    {tools.map((tool) => (
                      <ToolCard key={tool.slug} tool={tool} />
                    ))}
                  </div>
                </Container>
              </section>
              {idx === 1 && (
                <Container size="wide" className="pb-2">
                  <AdUnit minHeight={110} />
                </Container>
              )}
            </Fragment>
          );
        })
      )}
    </>
  );
}
