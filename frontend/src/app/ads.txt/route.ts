// Serves /ads.txt for AdSense. Generated from NEXT_PUBLIC_ADSENSE_CLIENT
// (ca-pub-XXXX → pub-XXXX). Returns a harmless comment until that env is set.
export const dynamic = "force-static";

export function GET(): Response {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const pub = client?.replace(/^ca-/, ""); // ca-pub-1234 -> pub-1234
  const body = pub
    ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
    : "# Set NEXT_PUBLIC_ADSENSE_CLIENT to generate your ads.txt entry.\n";
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
