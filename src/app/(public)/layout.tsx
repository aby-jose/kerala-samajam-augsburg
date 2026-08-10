import { AuthProvider } from "@/components/providers/auth-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import NextTopLoader from "nextjs-toploader";
import { getConfig } from "@/lib/config-utils";
import { ConfigProvider } from "@/components/providers/config-provider";

import { ToastProvider } from "@/components/ui/toast";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { ConsentGate } from "@/components/legal/consent-gate";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getConfig();

  return (
    <AuthProvider basePath="/api/auth">
      <ConfigProvider initialConfig={config}>
        <ToastProvider>
          <ConsentGate>
            <div className="flex flex-col min-h-screen">
              <NextTopLoader color="hsl(var(--primary))" showSpinner={false} height={2} />
              <Navbar />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
            <CookieConsent />
          </ConsentGate>
        </ToastProvider>
      </ConfigProvider>
    </AuthProvider>
  );
}
