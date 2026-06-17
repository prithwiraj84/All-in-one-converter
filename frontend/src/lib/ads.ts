export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
export const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "";

/**
 * Use Google's Funding Choices CMP for consent (recommended; required for
 * EEA/UK AdSense — it's geo-aware, so only EU users get prompted while everyone
 * else still sees ads). When true (the default), Google handles the consent
 * message and AdSense ad-serving waits for that signal, so we neither show the
 * built-in banner nor gate ad loading on our own localStorage flag.
 *
 * Set NEXT_PUBLIC_USE_GOOGLE_CMP=false to use the simple built-in banner instead.
 */
export const USE_GOOGLE_CMP =
  (process.env.NEXT_PUBLIC_USE_GOOGLE_CMP ?? "true").toLowerCase() !== "false";
