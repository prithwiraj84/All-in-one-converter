import { cn } from "@/lib/utils";

interface LoaderProps {
  /** Pixel size of the spinner square. */
  size?: number;
  /** Optional caption shown beneath the spinner. */
  label?: string;
  className?: string;
}

/**
 * Branded animated SVG loader.
 *
 * - A rotating brand-gradient arc (blue → violet → cyan) on a faint track.
 * - Three counter-rotating playful dots (rose / amber / emerald).
 * - A soft pulsing multi-colour glow + a pulsing gradient core.
 *
 * Pure SVG + CSS (no hooks) so it is safe in Server Components and Suspense
 * fallbacks. Honours `prefers-reduced-motion`.
 */
export function Loader({ size = 56, label, className }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("inline-flex flex-col items-center gap-3", className)}
    >
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        {/* soft pulsing glow */}
        <span className="absolute inset-[-20%] rounded-full bg-fun-gradient opacity-25 blur-xl animate-pulse-glow motion-reduce:animate-none" />

        {/* rotating gradient arc */}
        <svg
          viewBox="0 0 50 50"
          className="absolute inset-0 h-full w-full animate-spin [animation-duration:1.1s] motion-reduce:animate-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="aio-loader-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" />
              <stop offset="50%" stopColor="hsl(262 83% 58%)" />
              <stop offset="100%" stopColor="hsl(188 94% 43%)" />
            </linearGradient>
          </defs>
          <circle cx="25" cy="25" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="4.5" />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="url(#aio-loader-grad)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray="94 32"
          />
        </svg>

        {/* counter-rotating playful orbit dots */}
        <svg
          viewBox="0 0 50 50"
          className="absolute inset-0 h-full w-full animate-spin-reverse motion-reduce:animate-none"
          aria-hidden="true"
        >
          <circle cx="25" cy="5.5" r="2.3" fill="#ff5f6d" />
          <circle cx="44.5" cy="25" r="2.3" fill="#f9c80e" />
          <circle cx="5.5" cy="25" r="2.3" fill="#06d6a0" />
        </svg>

        {/* pulsing gradient core */}
        <span className="relative h-[26%] w-[26%] rounded-full bg-brand-gradient shadow-glow animate-pulse motion-reduce:animate-none" />
      </span>

      {label ? <span className="text-sm font-medium text-muted-foreground">{label}</span> : null}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Centered full-area variant for route `loading.tsx` Suspense fallbacks. */
export function FullScreenLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] w-full place-items-center px-6 py-24">
      <Loader size={72} label={label} />
    </div>
  );
}
