import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategory, type Tool } from "@/lib/tools-registry";

/** Tool tile used in the tools grid, showcase and related sections.
 *  A compact row on phones, a card from `sm` up. */
export function ToolCard({ tool, className }: { tool: Tool; className?: string }) {
  const category = getCategory(tool.category);
  const Icon = tool.icon;

  return (
    <Link
      href={`/${tool.slug}`}
      className={cn(
        "group relative flex items-center gap-3.5 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:border-primary/30 hover:shadow-card-hover sm:flex-col sm:items-start sm:gap-3 sm:p-5 sm:hover:-translate-y-1",
        className,
      )}
    >
      {/* hover glow */}
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />

      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          category.gradient,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="flex flex-wrap items-center gap-1.5 font-display text-[15px] font-semibold leading-tight">
          {tool.title}
          {tool.popular && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent">
              Popular
            </span>
          )}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
      </div>

      {/* Phones: a chevron says "tap me"; larger screens reveal a label on hover. */}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
      <span className="mt-auto hidden items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100 sm:inline-flex">
        Open tool
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
