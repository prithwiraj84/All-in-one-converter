"use client";

import { useId, useMemo, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { getCategory, type Tool } from "@/lib/tools-registry";
import { SEARCH_EXAMPLES, searchTools } from "@/lib/tool-search";
import { cn } from "@/lib/utils";

/** Big, friendly search input (16px text so phones don't zoom in on focus). */
export function SearchField({
  value,
  onChange,
  placeholder = "Search tools — e.g. compress PDF",
  className,
  inputProps,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        className="h-12 w-full rounded-xl border border-input bg-background pl-12 pr-12 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        {...inputProps}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ToolResultRow({
  tool,
  active,
  id,
  onSelect,
}: {
  tool: Tool;
  active?: boolean;
  id?: string;
  onSelect?: () => void;
}) {
  const Icon = tool.icon;
  return (
    <Link
      href={`/${tool.slug}`}
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted",
        active && "bg-muted",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white",
          getCategory(tool.category).gradient,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{tool.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{tool.description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/**
 * "What do you want to do?" search. Results appear right below the input
 * (pushing content down rather than floating, so nothing is clipped on small
 * screens). Arrow keys move through results, Enter opens one.
 */
export function ToolSearch({
  placeholder,
  onNavigate,
  showExamples = false,
  limit = 6,
  className,
}: {
  placeholder?: string;
  /** Called when a result is chosen (e.g. to close the mobile menu). */
  onNavigate?: () => void;
  showExamples?: boolean;
  limit?: number;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const listId = useId();
  const results = useMemo(() => searchTools(query, limit), [query, limit]);
  const searching = query.trim().length > 0;

  function choose(tool: Tool) {
    onNavigate?.();
    router.push(`/${tool.slug}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[Math.min(active, results.length - 1)]);
    }
  }

  return (
    <div className={className}>
      <SearchField
        value={query}
        onChange={(v) => {
          setQuery(v);
          setActive(0);
        }}
        placeholder={placeholder}
        inputProps={{
          role: "combobox",
          "aria-expanded": searching && results.length > 0,
          "aria-controls": listId,
          "aria-activedescendant": searching && results.length ? `${listId}-${active}` : undefined,
          "aria-label": "Search tools",
          onKeyDown,
        }}
      />

      {searching ? (
        results.length ? (
          <div id={listId} role="listbox" className="mt-2 space-y-0.5 rounded-xl border border-border bg-card p-1.5 shadow-card">
            {results.map((tool, i) => (
              <ToolResultRow key={tool.slug} id={`${listId}-${i}`} tool={tool} active={i === active} onSelect={onNavigate} />
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No tool matches “{query.trim()}”. Try a simpler word like <strong>compress</strong>, <strong>convert</strong> or{" "}
            <strong>PDF</strong> — or{" "}
            <Link href="/tools" onClick={onNavigate} className="font-medium text-primary underline-offset-2 hover:underline">
              browse all tools
            </Link>
            .
          </p>
        )
      ) : (
        showExamples && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
            {SEARCH_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="min-h-9 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
