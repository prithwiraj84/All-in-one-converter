import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** A small four-point sparkle that twinkles independently of the hand. */
function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden>
      <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z" />
    </svg>
  );
}

/**
 * Colorful animated waving hand for the dashboard welcome header.
 * Warm gradient hand + brand-gradient cuff that waves about the wrist, with
 * multi-colour sparkles twinkling around it. Pure CSS animations (no JS), so it
 * works in a server component.
 */
export function WavingHand({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      <span className="block h-full w-full origin-bottom animate-wave [will-change:transform]">
        <svg
          viewBox="0 0 48 50"
          className="h-full w-full overflow-visible [filter:drop-shadow(0_3px_4px_rgba(245,147,49,0.45))]"
          aria-hidden
        >
          <defs>
            <linearGradient id="aioHandSkin" gradientUnits="userSpaceOnUse" x1="10" y1="6" x2="40" y2="46">
              <stop offset="0" stopColor="#FFE7BE" />
              <stop offset="0.5" stopColor="#FFB85C" />
              <stop offset="1" stopColor="#F2922E" />
            </linearGradient>
            <linearGradient id="aioHandCuff" gradientUnits="userSpaceOnUse" x1="12" y1="40" x2="36" y2="50">
              <stop offset="0" stopColor="#2563EB" />
              <stop offset="0.5" stopColor="#7C3AED" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
          </defs>

          {/* palm + fingers + thumb share one gradient for a seamless look */}
          <g fill="url(#aioHandSkin)" stroke="#D9772A" strokeOpacity="0.4" strokeWidth="0.6" strokeLinejoin="round">
            <rect x="6.4" y="25" width="5.2" height="14.5" rx="2.6" transform="rotate(-42 16 33)" />
            <rect x="12" y="22" width="23" height="22" rx="9.5" />
            <rect x="13.6" y="11.5" width="4.9" height="17.5" rx="2.45" />
            <rect x="19" y="7.5" width="5.1" height="21.5" rx="2.55" />
            <rect x="24.7" y="9.5" width="5.1" height="19.5" rx="2.55" />
            <rect x="30.3" y="13.5" width="4.6" height="15.5" rx="2.3" />
          </g>

          {/* soft highlight for depth */}
          <ellipse cx="20" cy="26" rx="5" ry="7.5" fill="#FFFFFF" opacity="0.18" />

          {/* brand-gradient wrist cuff */}
          <rect x="12.5" y="39.5" width="22" height="9.5" rx="4.75" fill="url(#aioHandCuff)" />
          <rect x="12.5" y="39.5" width="22" height="3.4" rx="1.7" fill="#FFFFFF" opacity="0.22" />
        </svg>
      </span>

      {/* sparkles — twinkle on their own staggered timing */}
      <Sparkle className="absolute -right-1.5 top-0 h-3 w-3 animate-twinkle text-cyan-400" />
      <Sparkle
        className="absolute -left-2 top-1.5 h-2.5 w-2.5 animate-twinkle text-fuchsia-500"
        style={{ animationDelay: "0.55s" }}
      />
      <Sparkle
        className="absolute -right-1 bottom-1 h-2 w-2 animate-twinkle text-amber-400"
        style={{ animationDelay: "1.05s" }}
      />
    </span>
  );
}
