import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

/** Shell for all public marketing + tool pages: persistent navbar and footer. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-16">{children}</main>
      <Footer />
    </div>
  );
}
