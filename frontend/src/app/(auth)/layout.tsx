import Link from "next/link";
import { ArrowLeft, ShieldCheck, Zap, Trash2 } from "lucide-react";
import { Logo } from "@/components/shared/logo";

/** Split-screen auth shell: form on the left, brand panel on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden bg-foreground lg:block">
        <div className="absolute inset-0 bg-brand-gradient bg-[length:200%_200%] opacity-90 animate-gradient-shift" />
        <div className="absolute inset-0 bg-grid opacity-10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div />
          <div className="space-y-6">
            <h2 className="font-display text-3xl font-bold leading-tight">
              All your file tools.
              <br />
              One powerful platform.
            </h2>
            <p className="max-w-md text-white/80">
              Join 50,000+ people converting, compressing and editing files every day — securely
              and beautifully.
            </p>
            <ul className="space-y-3">
              {[
                { icon: Zap, text: "100+ tools, lightning fast" },
                { icon: ShieldCheck, text: "Encrypted, private processing" },
                { icon: Trash2, text: "Files auto-deleted in 60 minutes" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-white/90">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-white/60">© {new Date().getFullYear()} All in one converter</p>
        </div>
      </div>
    </div>
  );
}
