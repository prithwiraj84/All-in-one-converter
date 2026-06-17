import Script from "next/script";
import { ADSENSE_CLIENT, USE_GOOGLE_CMP } from "@/lib/ads";

/**
 * Google Funding Choices — the certified Consent Management Platform tied to
 * your AdSense account. It shows a geo-aware consent message (EEA/UK users get
 * prompted; others see ads normally) and signals consent to AdSense. Configure
 * the message in AdSense → Privacy & messaging. Loads only when AdSense is set
 * and the CMP is enabled.
 */
export function FundingChoices() {
  if (!USE_GOOGLE_CMP || !ADSENSE_CLIENT) return null;
  const pub = ADSENSE_CLIENT.replace(/^ca-/, ""); // ca-pub-1234 -> pub-1234

  return (
    <>
      <Script
        id="google-fc-loader"
        strategy="afterInteractive"
        src={`https://fundingchoicesmessages.google.com/i/${pub}?ers=1`}
      />
      <Script id="google-fc-present" strategy="afterInteractive">
        {`(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){const i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';i.style.display='none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`}
      </Script>
    </>
  );
}
