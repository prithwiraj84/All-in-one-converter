import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site-config";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Render on demand at request time. Avoids prerendering the @vercel/og route at
// build (which mis-resolves its bundled font when the project path contains spaces).
export const dynamic = "force-dynamic";

// Dynamically rendered OpenGraph image used across the site.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(120deg, #2563EB 0%, #7C3AED 50%, #06B6D4 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            ⚡
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, opacity: 0.95 }}>{SITE.name}</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Transform Any File
          <br />
          In Seconds
        </div>
        <div style={{ fontSize: 30, marginTop: 28, opacity: 0.9, maxWidth: 900 }}>
          {SITE.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
