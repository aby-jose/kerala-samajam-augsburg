import { AuthProvider } from "@/components/providers/auth-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import NextTopLoader from "nextjs-toploader";
import { getConfig } from "@/lib/config-utils";
import { ConfigProvider } from "@/components/providers/config-provider";

import { ToastProvider } from "@/components/ui/toast";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { ConsentGate } from "@/components/legal/consent-gate";
import { MaintenanceScreen } from "@/components/layout/maintenance-screen";
import { isMaintenanceLocked } from "@/lib/feature-gate";

/**
 * Required by the maintenance gate below, which is a runtime switch.
 *
 * Without this, `/about`, `/contact` and `/events` prerender at build time:
 * the config read here runs once during `next build`, maintenance is off then
 * by definition, and the unlocked HTML is cached. Throwing the lever in
 * production would seal every other page and quietly leave those three open.
 * The same staleness applied to the logo and site name already.
 */
export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getConfig();

  // The maintenance lever is enforced here rather than in middleware: this
  // layout wraps every public route, already awaits the config, and runs on the
  // server, so the lock is decided before a single byte of the real page is
  // rendered. Middleware could not do it anyway — the switch lives in MongoDB
  // and Prisma does not run in the edge runtime.
  //
  // `/admin` is a separate layout tree and is deliberately untouched, so the
  // portal and its login stay reachable while the public site is sealed.
  if (await isMaintenanceLocked()) {
    return <MaintenanceScreen config={config} />;
  }

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
            <WhatsAppFab />
          </ConsentGate>
        </ToastProvider>
      </ConfigProvider>
    </AuthProvider>
  );
}
