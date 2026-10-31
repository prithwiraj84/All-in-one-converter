"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DownloadGate } from "@/components/tools/download-gate";

/** Previews are free; downloading needs an account — the same rule as every
 *  other tool. Without Supabase configured (local dev) downloads are open. */
export function useDownloadAccess() {
  const { user, loading } = useUser();
  return { canDownload: !isSupabaseConfigured() || Boolean(user), checking: loading };
}

/** Download buttons for signed-in users, the sign-in prompt for everyone else. */
export function DownloadArea({ slug, children }: { slug: string; children: ReactNode }) {
  const { canDownload, checking } = useDownloadAccess();
  if (checking) return <div className="h-24 animate-pulse rounded-xl bg-muted/50" />;
  if (!canDownload) return <DownloadGate pending={null} redirectTo={`/${slug}`} />;
  return <>{children}</>;
}

/** Numbered step heading — guides first-time users through the generator. */
export function Step({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold leading-6 text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Generator layout. Phones: content → preview & download → design (so the
 * result is visible right after typing). Desktop: content + design on the
 * left, a sticky preview on the right.
 */
export function GeneratorShell({
  icon: Icon,
  title,
  description,
  content,
  design,
  preview,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  content: ReactNode;
  design: ReactNode;
  preview: ReactNode;
}) {
  return (
    // overflow-clip (not hidden) rounds the corners without breaking the sticky preview.
    <div className="overflow-clip rounded-2xl border border-border bg-card text-left shadow-card">
      <div className="flex items-center gap-3 border-b border-border bg-surface/60 px-4 py-3.5 sm:px-6 sm:py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr]">
        <div className="min-w-0 space-y-5 border-b border-border p-4 sm:p-6 lg:col-start-1 lg:row-start-1 lg:border-b-0 lg:border-r lg:pb-3">
          {content}
        </div>
        <div className="border-b border-border bg-surface/30 p-4 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-b-0 lg:bg-transparent">
          <div className="space-y-4 lg:sticky lg:top-24">{preview}</div>
        </div>
        <div className="min-w-0 space-y-4 p-4 sm:p-6 lg:col-start-1 lg:row-start-2 lg:border-r lg:pt-3">{design}</div>
      </div>
    </div>
  );
}

/** One collapsible group of design options. */
export function OptionGroup({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <AccordionItem value={value} className="last:border-b-0">
      <AccordionTrigger className="min-h-12 py-3.5 text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="space-y-4 text-foreground">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-surface p-1", className)} role="radiogroup">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icon && <Icon className="h-4 w-4" />}
          {label}
        </button>
      ))}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Native color picker plus an editable hex field. */
export function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className={cn("space-y-1.5", disabled && "opacity-50")}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-background px-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          id={id}
          value={draft}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setDraft(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
          className="h-full w-full min-w-0 bg-transparent font-mono text-base uppercase outline-none sm:text-sm"
        />
      </div>
    </div>
  );
}

export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-[hsl(var(--primary))]"
      />
    </div>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Preview frame; shows a checkerboard behind transparent output. */
export function PreviewStage({ transparent, children }: { transparent?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-h-[280px] place-items-center overflow-hidden rounded-xl border border-border p-4",
        !transparent && "bg-surface",
      )}
      style={
        transparent
          ? { background: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 18px 18px" }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "error" | "info"; children: ReactNode }) {
  const Icon = tone === "info" ? Info : TriangleAlert;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "warn" && "border-amber-300/70 bg-amber-50 text-amber-800",
        tone === "info" && "border-border bg-surface text-muted-foreground",
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
