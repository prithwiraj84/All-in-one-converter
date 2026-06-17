import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site-config";
import { LegalPage, H2, P, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE.name} collects, uses, processes and protects your information and files.`,
  alternates: { canonical: "/privacy" },
};

const UPDATED = "June 17, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro={`This Privacy Policy explains how ${SITE.name} ("we", "us", "our") collects, uses, shares and protects information when you use ${SITE.url} and our file tools (the "Service"). By using the Service you agree to this policy.`}
    >
      <H2>1. Information we collect</H2>
      <P>We collect only what we need to run the Service:</P>
      <UL>
        <li>
          <strong>Account information.</strong> If you create an account, we store your email address and, where you sign
          in with Google or GitHub, your name and profile photo as provided by that login. Authentication is handled by
          Supabase.
        </li>
        <li>
          <strong>Files you upload.</strong> Files you submit for server-side processing are stored temporarily only to
          perform the requested task (see “How we handle your files” below).
        </li>
        <li>
          <strong>Usage data.</strong> For signed-in users we record a history of conversions (the tool used, timestamps,
          output file name and size) so you can see and re-download recent results from your dashboard.
        </li>
        <li>
          <strong>Payment information.</strong> Paid plans are processed by Razorpay. We do <strong>not</strong> receive or
          store your card details; we only record your plan and its expiry.
        </li>
        <li>
          <strong>Technical data &amp; cookies.</strong> Standard log data (IP address, browser type) for security and
          rate-limiting, and cookies needed for sign-in, plus optional analytics/advertising cookies (see below).
        </li>
      </UL>

      <H2>2. How we handle your files</H2>
      <UL>
        <li>
          <strong>Many tools run entirely in your browser.</strong> Several light tools (e.g. image convert/resize/compress
          and basic PDF operations) process files <strong>on your own device</strong> — those files are never uploaded to
          our servers.
        </li>
        <li>
          <strong>Server-side tools auto-delete your files.</strong> Files processed on our servers are deleted
          automatically — within <strong>60 minutes</strong> on the Free plan and <strong>1 day</strong> on paid plans —
          after which both the upload and the result are permanently removed.
        </li>
        <li>
          <strong>We do not sell your files or use them to train AI models.</strong> Your documents remain yours.
        </li>
      </UL>

      <H2>3. AI-powered tools</H2>
      <P>
        Some AI tools send your content to third-party providers solely to perform the task you requested: image captioning
        and higher-quality translation use Google’s Gemini API; text-to-speech uses Microsoft’s neural voice service;
        speech-to-text runs on our own servers. Content sent to these providers is used only to return your result.
      </P>

      <H2>4. How we use your information</H2>
      <UL>
        <li>To provide, operate and improve the Service and your conversions.</li>
        <li>To enforce plan limits, quotas and security (rate-limiting, abuse prevention).</li>
        <li>To process payments and manage your subscription.</li>
        <li>To communicate important service or account notices.</li>
      </UL>

      <H2>5. Cookies &amp; advertising</H2>
      <P>
        We use essential cookies for authentication. We may use analytics and, on the Free plan, third-party advertising
        (such as Google AdSense). Advertising partners may use cookies to show relevant ads and measure performance. Paid
        (Pro/Business) users are not shown ads. Where required (e.g. in the EEA/UK), we ask for your consent before setting
        non-essential cookies, and you can withdraw it at any time through the cookie settings.
      </P>

      <H2>6. Third-party services we rely on</H2>
      <UL>
        <li><strong>Supabase</strong> — authentication and database.</li>
        <li><strong>Hugging Face</strong> — backend hosting and file processing.</li>
        <li><strong>Vercel</strong> — frontend hosting.</li>
        <li><strong>Razorpay</strong> — payment processing.</li>
        <li><strong>Google</strong> — sign-in, the Gemini AI API, and (Free plan) advertising.</li>
        <li><strong>Microsoft</strong> — text-to-speech voices.</li>
      </UL>
      <P>Each provider processes data under its own privacy policy.</P>

      <H2>7. Sharing your information</H2>
      <P>
        We do not sell your personal information. We share data only with the service providers above to operate the
        Service, or where required by law.
      </P>

      <H2>8. Data retention</H2>
      <P>
        Uploaded files and their results are deleted automatically per the windows above. Account and conversion-history
        records are kept while your account is active; delete your account to remove them.
      </P>

      <H2>9. Your rights</H2>
      <P>
        You can access and download your recent files from your dashboard, delete individual files, and request deletion of
        your account and associated data by contacting us. Depending on your location, you may have rights to access,
        correct, delete or port your personal data (e.g. under the GDPR or applicable Indian law).
      </P>

      <H2>10. Security</H2>
      <P>
        Files are transferred over encrypted (TLS) connections and stored in isolated, automatically-purged locations.
        Access to user data is restricted. No method of transmission or storage is 100% secure, but we take reasonable
        measures to protect your information.
      </P>

      <H2>11. Children</H2>
      <P>The Service is not directed to children under 13 (or the minimum age in your country), and we do not knowingly collect their data.</P>

      <H2>12. Changes to this policy</H2>
      <P>We may update this policy from time to time. Material changes will be reflected by the “Last updated” date above.</P>

      <H2>13. Contact</H2>
      <P>
        Questions or requests? Email us at{" "}
        <Link href={`mailto:${SITE.email}`} className="text-primary underline-offset-2 hover:underline">
          {SITE.email}
        </Link>
        . See also our{" "}
        <Link href="/terms" className="text-primary underline-offset-2 hover:underline">
          Terms of Service
        </Link>
        .
      </P>
    </LegalPage>
  );
}
