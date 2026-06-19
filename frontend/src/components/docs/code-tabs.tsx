"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CodeSample {
  curl?: string;
  python?: string;
  js?: string;
}

const LANGS: { key: keyof CodeSample; label: string }[] = [
  { key: "curl", label: "cURL" },
  { key: "python", label: "Python" },
  { key: "js", label: "JavaScript" },
];

/** Tabbed multi-language code block (cURL / Python / JavaScript) with copy. */
export function CodeTabs({ samples }: { samples: CodeSample }) {
  const available = LANGS.filter((l) => samples[l.key]);
  const [active, setActive] = React.useState<keyof CodeSample>(available[0]?.key ?? "curl");
  const [copied, setCopied] = React.useState(false);
  const code = samples[active] ?? "";

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-2">
        <div className="flex">
          {available.map((l) => (
            <button
              key={l.key}
              onClick={() => setActive(l.key)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors",
                active === l.key
                  ? "border-b-2 border-primary text-white"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="mr-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Single-language code block with a copy button. */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-slate-950">
      {lang && (
        <span className="absolute left-3 top-2 text-[10px] uppercase tracking-wider text-slate-500">{lang}</span>
      )}
      <button
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className={cn("overflow-x-auto p-4 text-xs leading-relaxed text-slate-100", lang && "pt-6")}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
