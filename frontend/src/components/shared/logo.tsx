import Link from "next/link";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="All in one converter home">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient bg-[length:200%_200%] shadow-glow transition-transform group-hover:scale-105">
        <Layers className="h-5 w-5 text-white" strokeWidth={2.4} />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/30" />
      </span>
      {showText && (
        <span className="text-[15px] font-semibold leading-none tracking-tight">
          All in one<span className="text-gradient"> converter</span>
        </span>
      )}
    </Link>
  );
}
