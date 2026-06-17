import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site-config";
import { LegalPage, H2, P, UL } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms and conditions for using ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

const UPDATED = "June 17, 2026";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated={UPDATED}
      intro={`These Terms of Service ("Terms") govern your use of ${SITE.name} at ${SITE.url} (the "Service"). By accessing or using the Service, you agree to these Terms. If you do not agree, do not use the Service.`}
    >
      <H2>1. The Service</H2>
      <P>
        {SITE.name} provides online tools to convert, compress, edit and process files (PDF, images, audio, video,
        documents and more), including AI-assisted tools. We may add, change or remove features at any time.
      </P>

      <H2>2. Eligibility &amp; accounts</H2>
      <P>
        You must be at least 13 years old (or the minimum age in your country) to use the Service. Some features require an
        account; you are responsible for keeping your credentials secure and for all activity under your account.
      </P>

      <H2>3. Acceptable use</H2>
      <P>You agree not to use the Service to:</P>
      <UL>
        <li>upload, process or distribute content that is illegal, infringing, malicious, or that you do not have the right to use;</li>
        <li>violate the intellectual-property or privacy rights of others;</li>
        <li>upload malware, or attempt to disrupt, overload, reverse-engineer or gain unauthorized access to the Service;</li>
        <li>circumvent plan limits, quotas, rate limits or security measures, or resell the Service without permission.</li>
      </UL>
      <P>We may suspend or terminate access for violations.</P>

      <H2>4. Your files &amp; content</H2>
      <P>
        You retain all ownership of the files you process. You grant us a limited, temporary license to store and process
        your files <strong>only</strong> to perform the task you request, after which they are deleted automatically (within
        60 minutes on Free, 1 day on paid plans). You are solely responsible for the files you submit and for keeping your
        own backups.
      </P>

      <H2>5. Plans, billing &amp; refunds</H2>
      <UL>
        <li>
          <strong>Free, Pro and Business plans</strong> are described on our{" "}
          <Link href="/#pricing" className="text-primary underline-offset-2 hover:underline">pricing page</Link>. Limits
          (file size, daily tasks, storage, retention) apply per plan.
        </li>
        <li>
          <strong>Payments</strong> are processed securely by Razorpay. Paid plans are currently a{" "}
          <strong>one-time purchase that grants the plan for 30 days</strong> and do not auto-renew; you may renew at any
          time.
        </li>
        <li>
          <strong>Refunds.</strong> Because the Service is delivered immediately, payments are generally non-refundable
          except where required by law or in case of a clear billing error. Contact us if you believe you were charged in
          error.
        </li>
        <li>Prices and plan features may change; changes apply to future purchases.</li>
      </UL>

      <H2>6. AI features</H2>
      <P>
        AI tools (captioning, translation, text-to-speech, transcription) may use third-party providers and can produce
        inaccurate or unexpected results. Review outputs before relying on them. Do not submit content you are not permitted
        to share with those providers.
      </P>

      <H2>7. Intellectual property</H2>
      <P>
        The Service, including its software, design and branding, is owned by us and protected by law. These Terms grant you
        no rights to our intellectual property other than to use the Service as permitted.
      </P>

      <H2>8. Disclaimers</H2>
      <P>
        The Service is provided <strong>“as is” and “as available”</strong>, without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that
        conversions will be error-free, that the Service will be uninterrupted, or that files will always be available
        before their automatic deletion.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, we will not be liable for any indirect, incidental, special or
        consequential damages, or for any loss of data, files, profits or goodwill, arising from your use of the Service.
        Our total liability for any claim will not exceed the amount you paid us in the 3 months before the claim (or, if
        you paid nothing, INR 1,000).
      </P>

      <H2>10. Indemnification</H2>
      <P>
        You agree to indemnify and hold us harmless from claims arising out of your files, your use of the Service, or your
        violation of these Terms or any law.
      </P>

      <H2>11. Termination</H2>
      <P>
        You may stop using the Service at any time. We may suspend or terminate your access if you violate these Terms or to
        protect the Service. Sections that by their nature should survive termination (e.g. ownership, disclaimers,
        liability) will survive.
      </P>

      <H2>12. Governing law</H2>
      <P>These Terms are governed by the laws of India, without regard to conflict-of-law rules, and disputes are subject to the courts of India.</P>

      <H2>13. Changes</H2>
      <P>We may update these Terms; the “Last updated” date reflects the latest version. Continued use after changes means you accept them.</P>

      <H2>14. Contact</H2>
      <P>
        Questions about these Terms? Email{" "}
        <Link href={`mailto:${SITE.email}`} className="text-primary underline-offset-2 hover:underline">
          {SITE.email}
        </Link>
        . See also our{" "}
        <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        .
      </P>
    </LegalPage>
  );
}
