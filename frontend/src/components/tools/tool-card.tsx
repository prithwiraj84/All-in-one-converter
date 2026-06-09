import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategory, type Tool } from "@/lib/tools-registry";

/** Compact tool tile used in the tools grid, showcase and related sections. */
export function ToolCard({ tool, className }: { tool: Tool; className?: string }) {
  const category = getCategory(tool.category);
  const Icon = tool.icon;

  return (
    <Link
      href={`/${tool.slug}`}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover",
        className,
      )}
    >
      {/* hover glow */}
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />

      <div
        className={cn(
          "grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          category.gradient,
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>

      <div className="space-y-1">
        <h3 className="flex items-center gap-1.5 font-display text-[15px] font-semibold leading-tight">
          {tool.title}
          {tool.popular && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
              Popular
            </span>
          )}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{tool.description}</p>
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100">
        Open tool
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
