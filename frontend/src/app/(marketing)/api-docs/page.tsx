import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Terminal, KeyRound, Zap, ShieldCheck, Boxes, AlertTriangle, Gauge } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Badge } from "@/components/ui/badge";
import { CodeTabs, CodeBlock } from "@/components/docs/code-tabs";
import { API_BASE } from "@/lib/api";
import { absoluteUrl } from "@/lib/utils";
import {
  API_REFERENCE,
  RESPONSE_FIELDS,
  API_ERRORS,
  PLAN_QUOTAS,
  type ApiEndpoint,
} from "@/lib/api-reference";

export const metadata: Metadata = {
  title: "REST API — Developer Documentation",
  description:
    "Complete reference for the All in one converter REST API: authentication, every endpoint and option, request/response format, error codes, rate limits, and cURL / Python / JavaScript examples.",
  alternates: { canonical: absoluteUrl("/api-docs") },
};

const BASE = API_BASE || "https://your-backend";

const TOC = [
  { id: "intro", label: "Introduction" },
  { id: "auth", label: "Authentication" },
  { id: "base-url", label: "Base URL" },
  { id: "quickstart", label: "Quickstart" },
  { id: "requests", label: "Making requests" },
  { id: "response", label: "Response object" },
  { id: "downloads", label: "Downloading results" },
  { id: "text-results", label: "Text results" },
  { id: "errors", label: "Errors" },
  { id: "limits", label: "Rate limits & quotas" },
  { id: "reference", label: "Endpoint reference" },
  { id: "best-practices", label: "Best practices" },
];

/* ── code samples ───────────────────────────────────────────────── */
const authSample = {
  curl: `curl ${BASE}/api/pdf/compress \\
  -H "Authorization: Bearer aio_live_xxxxxxxxxxxxxxxx"`,
  python: `import requests

BASE = "${BASE}"
KEY  = "aio_live_xxxxxxxxxxxxxxxx"

headers = {"Authorization": f"Bearer {KEY}"}`,
  js: `const BASE = "${BASE}";
const KEY  = "aio_live_xxxxxxxxxxxxxxxx";

const headers = { Authorization: \`Bearer \${KEY}\` };`,
};

const quickstartSample = {
  curl: `# 1) Convert — POST the file as multipart/form-data
curl -X POST ${BASE}/api/pdf/compress \\
  -H "Authorization: Bearer aio_live_xxxxxxxx" \\
  -F "files=@invoice.pdf" \\
  -F "level=recommended"

# Response:
# { "job_id":"a1b2c3", "status":"completed",
#   "download_url":"/api/files/download/a1b2c3/invoice.pdf",
#   "output_filename":"invoice.pdf", "output_size":184320 }

# 2) Download the result (no auth needed on download URLs)
curl -o compressed.pdf ${BASE}/api/files/download/a1b2c3/invoice.pdf`,
  python: `import requests

BASE = "${BASE}"
KEY  = "aio_live_xxxxxxxx"
headers = {"Authorization": f"Bearer {KEY}"}

# 1) Convert
with open("invoice.pdf", "rb") as f:
    r = requests.post(
        f"{BASE}/api/pdf/compress",
        headers=headers,
        files={"files": ("invoice.pdf", f, "application/pdf")},
        data={"level": "recommended"},
    )
r.raise_for_status()
job = r.json()

# 2) Download the result
out = requests.get(BASE + job["download_url"])
with open(job["output_filename"], "wb") as f:
    f.write(out.content)

print("saved", job["output_filename"], job["output_size"], "bytes")`,
  js: `// Node 18+ or the browser (both have fetch + FormData)
const BASE = "${BASE}";
const KEY  = "aio_live_xxxxxxxx";

// 1) Convert
const form = new FormData();
form.append("files", fileBlob, "invoice.pdf"); // a File/Blob
form.append("level", "recommended");

const res = await fetch(\`\${BASE}/api/pdf/compress\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${KEY}\` }, // do NOT set Content-Type
  body: form,
});
if (!res.ok) throw new Error((await res.json()).detail);
const job = await res.json();

// 2) Download the result
const out = await fetch(BASE + job.download_url);
const blob = await out.blob(); // save to disk (Node) or createObjectURL (browser)`,
};

const multiSample = {
  curl: `# Send several files under the same "files" field
curl -X POST ${BASE}/api/pdf/merge \\
  -H "Authorization: Bearer aio_live_xxxxxxxx" \\
  -F "files=@a.pdf" \\
  -F "files=@b.pdf" \\
  -F "files=@c.pdf"`,
  python: `files = [
    ("files", ("a.pdf", open("a.pdf", "rb"), "application/pdf")),
    ("files", ("b.pdf", open("b.pdf", "rb"), "application/pdf")),
]
r = requests.post(f"{BASE}/api/pdf/merge", headers=headers, files=files)
job = r.json()  # job["download_url"] → merged.pdf`,
  js: `const form = new FormData();
for (const f of [fileA, fileB, fileC]) form.append("files", f, f.name);
const res = await fetch(\`\${BASE}/api/pdf/merge\`, {
  method: "POST", headers, body: form,
});
const job = await res.json();`,
};

const textSample = {
  curl: `curl -X POST ${BASE}/api/ocr/image \\
  -H "Authorization: Bearer aio_live_xxxxxxxx" \\
  -F "files=@scan.png" -F "lang=eng"

# → { "status":"completed", "text":"…extracted text…",
#     "download_url":null, "meta":{"chars":1280,"language":"eng"} }`,
  python: `r = requests.post(f"{BASE}/api/ocr/image", headers=headers,
                  files={"files": open("scan.png", "rb")}, data={"lang": "eng"})
print(r.json()["text"])   # inline text — no download needed`,
  js: `const form = new FormData();
form.append("files", scanFile);
form.append("lang", "eng");
const job = await (await fetch(\`\${BASE}/api/ocr/image\`, { method:"POST", headers, body: form })).json();
console.log(job.text);`,
};

const errorSample = {
  curl: `# -i shows the status line + headers (look for Retry-After on 429/503)
curl -i -X POST ${BASE}/api/pdf/compress \\
  -H "Authorization: Bearer aio_live_xxxxxxxx" -F "files=@big.pdf"

# 413 → { "detail":"big.pdf exceeds the 1 GB per-file limit on the Business plan." }
# 429 → { "detail":"Rate limit exceeded. Try again in 12s.", "code":"rate_limited" }`,
  python: `import time, requests

def convert(path, retries=3):
    for attempt in range(retries):
        with open(path, "rb") as f:
            r = requests.post(f"{BASE}/api/pdf/compress",
                              headers=headers, files={"files": f})
        if r.status_code in (429, 503):          # backoff + retry
            time.sleep(int(r.headers.get("Retry-After", 5)))
            continue
        if not r.ok:
            body = r.json()
            raise RuntimeError(f"{r.status_code} {body.get('code','')}: {body['detail']}")
        return r.json()
    raise RuntimeError("still busy after retries")`,
  js: `async function convert(file, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const form = new FormData();
    form.append("files", file);
    const res = await fetch(\`\${BASE}/api/pdf/compress\`, { method:"POST", headers, body: form });
    if (res.status === 429 || res.status === 503) {
      const wait = Number(res.headers.get("Retry-After") || 5);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(\`\${res.status} \${body.code ?? ""}: \${body.detail}\`);
    return body;
  }
  throw new Error("still busy after retries");
}`,
};

/* ── small server components ────────────────────────────────────── */
function H2({ id, icon: Icon, children }: { id: string; icon?: typeof Zap; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
      {Icon && <Icon className="h-5 w-5 text-primary" />} {children}
    </h2>
  );
}

function FieldTable({ endpoint }: { endpoint: ApiEndpoint }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {endpoint.fields.map((f) => (
            <tr key={f.name} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 font-mono font-medium">
                {f.name}
                {f.required && <span className="ml-1 text-[10px] font-semibold text-destructive">required</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{f.type}</td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{f.default ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {f.description}
                {f.allowed && (
                  <span className="mt-1 block">
                    <span className="text-foreground">Allowed:</span>{" "}
                    {f.allowed.map((a) => (
                      <code key={a} className="mr-1 rounded bg-muted px-1 py-0.5 text-[11px]">{a}</code>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <Container size="wide" className="py-12">
      <div className="lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        {/* TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
            {TOC.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {t.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="max-w-3xl">
          {/* Intro */}
          <section id="intro" className="scroll-mt-24">
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Terminal className="h-3.5 w-3.5" /> Developer API
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight">REST API</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Automate file conversions from your own apps, scripts and backends. Every tool on the site is an
              HTTPS endpoint — upload a file, get a result. No SDK required.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Business plan
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5">
                <Zap className="h-4 w-4 text-primary" /> Unlimited requests
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5">
                <Boxes className="h-4 w-4 text-primary" /> {API_REFERENCE.reduce((n, c) => n + c.endpoints.length, 0)}+ endpoints
              </span>
            </div>
          </section>

          {/* Auth */}
          <section className="mt-12">
            <H2 id="auth" icon={KeyRound}>Authentication</H2>
            <p className="mt-2 text-muted-foreground">
              Create a key under{" "}
              <Link href="/dashboard?tab=api" className="text-primary underline-offset-2 hover:underline">Dashboard → API</Link>{" "}
              (Business plan), then send it as a <strong>Bearer token</strong> on every request. Keys look like
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-sm">aio_live_…</code> and are shown once — store them
              securely and never expose them in client-side code. Revoke a leaked key anytime.
            </p>
            <div className="mt-4">
              <CodeTabs samples={authSample} />
            </div>
          </section>

          {/* Base URL */}
          <section className="mt-12">
            <H2 id="base-url">Base URL</H2>
            <p className="mt-2 text-muted-foreground">All endpoints are relative to:</p>
            <div className="mt-3">
              <CodeBlock code={BASE} />
            </div>
          </section>

          {/* Quickstart */}
          <section className="mt-12">
            <H2 id="quickstart" icon={Zap}>Quickstart</H2>
            <p className="mt-2 text-muted-foreground">
              Convert a PDF and download the result. Send the file as <code className="rounded bg-muted px-1 py-0.5 text-sm">multipart/form-data</code>
              under the <code className="rounded bg-muted px-1 py-0.5 text-sm">files</code> field; tool options go in the same form.
            </p>
            <div className="mt-4">
              <CodeTabs samples={quickstartSample} />
            </div>
          </section>

          {/* Requests */}
          <section className="mt-12">
            <H2 id="requests">Making requests</H2>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>• <strong>Method:</strong> every processing endpoint is <code className="rounded bg-muted px-1 py-0.5 text-sm">POST</code>.</li>
              <li>• <strong>Body:</strong> <code className="rounded bg-muted px-1 py-0.5 text-sm">multipart/form-data</code>. The file(s) go under <code className="rounded bg-muted px-1 py-0.5 text-sm">files</code>; options are extra form fields.</li>
              <li>• <strong>Don&apos;t set <code className="rounded bg-muted px-1 py-0.5 text-sm">Content-Type</code> yourself</strong> — let your HTTP client set the multipart boundary.</li>
              <li>• <strong>Multiple files:</strong> repeat the <code className="rounded bg-muted px-1 py-0.5 text-sm">files</code> field. Some tools require ≥2 (merge); image batches return a ZIP.</li>
            </ul>
            <div className="mt-4">
              <CodeTabs samples={multiSample} />
            </div>
          </section>

          {/* Response */}
          <section className="mt-12">
            <H2 id="response">Response object</H2>
            <p className="mt-2 text-muted-foreground">
              A successful request returns <code className="rounded bg-muted px-1 py-0.5 text-sm">200</code> with this JSON envelope:
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted-foreground">
                  <tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {RESPONSE_FIELDS.map((f) => (
                    <tr key={f.name} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono font-medium">{f.name}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{f.type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <CodeBlock
                lang="json"
                code={`{
  "job_id": "9b1f7c0a4e7d4f2bb3c5d6e7f8a90123",
  "tool": "merge-pdf",
  "status": "completed",
  "download_url": "/api/files/download/9b1f7c0a…/merged.pdf",
  "output_filename": "merged.pdf",
  "output_size": 248913,
  "files": null,
  "text": null,
  "meta": { "pages": 12, "inputs": 2 }
}`}
              />
            </div>
          </section>

          {/* Downloads */}
          <section className="mt-12">
            <H2 id="downloads">Downloading results</H2>
            <p className="mt-2 text-muted-foreground">
              File results return a relative <code className="rounded bg-muted px-1 py-0.5 text-sm">download_url</code>. Prefix it
              with the base URL and <code className="rounded bg-muted px-1 py-0.5 text-sm">GET</code> it (download URLs are public and
              don&apos;t need the key). Files are deleted after your plan&apos;s retention window (Business: 1 day), so download promptly.
              Multi-file tools return a <code className="rounded bg-muted px-1 py-0.5 text-sm">files</code> array — iterate it and fetch each <code className="rounded bg-muted px-1 py-0.5 text-sm">download_url</code>.
            </p>
          </section>

          {/* Text results */}
          <section className="mt-12">
            <H2 id="text-results">Text results (OCR &amp; AI)</H2>
            <p className="mt-2 text-muted-foreground">
              OCR and some AI tools return text inline in the <code className="rounded bg-muted px-1 py-0.5 text-sm">text</code> field
              instead of a file (<code className="rounded bg-muted px-1 py-0.5 text-sm">download_url</code> is <code className="rounded bg-muted px-1 py-0.5 text-sm">null</code>).
            </p>
            <div className="mt-4">
              <CodeTabs samples={textSample} />
            </div>
          </section>

          {/* Errors */}
          <section className="mt-12">
            <H2 id="errors" icon={AlertTriangle}>Errors</H2>
            <p className="mt-2 text-muted-foreground">
              Errors use standard HTTP status codes with a JSON body of the form
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-sm">{"{ \"detail\": \"…\", \"code\": \"…\" }"}</code>
              (<code className="rounded bg-muted px-1 py-0.5 text-sm">code</code> present on some). Always handle <strong>429</strong> and
              <strong> 503</strong> by honoring <code className="rounded bg-muted px-1 py-0.5 text-sm">Retry-After</code>.
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted-foreground">
                  <tr><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">code</th><th className="px-3 py-2 font-medium">Meaning</th><th className="px-3 py-2 font-medium">When</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {API_ERRORS.map((e, i) => (
                    <tr key={i} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">{e.status}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">{e.code ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{e.meaning}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-muted-foreground">Robust client with retry/backoff:</p>
            <div className="mt-3">
              <CodeTabs samples={errorSample} />
            </div>
          </section>

          {/* Limits */}
          <section className="mt-12">
            <H2 id="limits" icon={Gauge}>Rate limits &amp; quotas</H2>
            <p className="mt-2 text-muted-foreground">
              Per-IP rate limit: <strong>60 requests/minute</strong> (429 <code className="rounded bg-muted px-1 py-0.5 text-sm">rate_limited</code>).
              Under heavy load the server may return <strong>503</strong> <code className="rounded bg-muted px-1 py-0.5 text-sm">server_busy</code> — retry after
              a few seconds. Plan quotas:
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-muted-foreground">
                  <tr><th className="px-3 py-2 font-medium">Plan</th><th className="px-3 py-2 font-medium">Max file</th><th className="px-3 py-2 font-medium">Storage</th><th className="px-3 py-2 font-medium">Tasks</th><th className="px-3 py-2 font-medium">Retention</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PLAN_QUOTAS.map((p) => (
                    <tr key={p.plan}>
                      <td className="px-3 py-2 font-semibold">{p.plan}</td>
                      <td className="px-3 py-2">{p.fileSize}</td>
                      <td className="px-3 py-2">{p.storage}</td>
                      <td className="px-3 py-2">{p.tasks}</td>
                      <td className="px-3 py-2">{p.retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The API is Business-only, so daily-task limits never apply to keys. Per-file size is also bounded by the
              server&apos;s upload ceiling.
            </p>
          </section>

          {/* Endpoint reference */}
          <section className="mt-12">
            <H2 id="reference" icon={Boxes}>Endpoint reference</H2>
            <p className="mt-2 text-muted-foreground">
              Every endpoint is <code className="rounded bg-muted px-1 py-0.5 text-sm">POST</code> and takes the
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-sm">files</code> field plus the options below.
            </p>
            <div className="mt-6 space-y-10">
              {API_REFERENCE.map((cat) => (
                <div key={cat.name}>
                  <h3 className="font-display text-lg font-semibold">{cat.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{cat.blurb}</p>
                  <div className="mt-4 space-y-5">
                    {cat.endpoints.map((ep) => (
                      <div key={ep.path} id={ep.path} className="scroll-mt-24 rounded-xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{ep.method}</span>
                          <code className="font-mono text-sm font-medium">{ep.path}</code>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {ep.result === "text" ? "→ text" : "→ file"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{ep.summary}</p>
                        <FieldTable endpoint={ep} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Best practices */}
          <section className="mt-12">
            <H2 id="best-practices">Best practices</H2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>• <strong>Keep keys server-side.</strong> Never ship a key in browser/mobile code — proxy through your backend.</li>
              <li>• <strong>Retry 429/503</strong> with exponential backoff, honoring <code className="rounded bg-muted px-1 py-0.5 text-sm">Retry-After</code>.</li>
              <li>• <strong>Download promptly</strong> — results expire after your retention window.</li>
              <li>• <strong>Rotate keys</strong> if one leaks: generate a new one, update your app, revoke the old.</li>
              <li>• <strong>Use a separate key per app/environment</strong> so you can revoke independently.</li>
            </ul>
          </section>

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-border bg-surface/60 p-6 text-center">
            <p className="font-semibold">Ready to build?</p>
            <p className="mt-1 text-sm text-muted-foreground">Generate your first key in the dashboard (Business plan).</p>
            <Link href="/dashboard?tab=api" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white">
              <KeyRound className="h-4 w-4" /> Go to API keys
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
}
