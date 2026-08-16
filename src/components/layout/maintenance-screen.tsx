import { Mail } from "lucide-react";

import { Container } from "@/components/layout/container";
import type { SiteConfig } from "@/lib/config-schema";

/**
 * What the public sees while `features.maintenanceMode` is on.
 *
 * A server component with no navigation and no links back into the site — the
 * point of the lever is that nothing else is reachable, so offering a menu
 * would only produce a screenful of 404s. The contact address stays, because
 * somebody who needs the committee during an outage still needs the committee.
 */
export function MaintenanceScreen({ config }: { config: SiteConfig }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-1 py-24">
      <Container className="flex flex-col items-center text-center">
        <img
          src={config.branding.logoUrl || "/images/logo.png"}
          alt={config.siteName}
          className="h-20 w-auto"
        />

        <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Back shortly
        </p>

        <h1 className="mt-5 max-w-2xl text-balance font-sans text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground md:text-4xl">
          {config.siteName} is down for maintenance
        </h1>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          We&apos;re making a few improvements and will be back soon. Thank you
          for your patience.
        </p>

        {config.contactEmail && (
          <a
            href={`mailto:${config.contactEmail}`}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Mail className="h-4 w-4" />
            {config.contactEmail}
          </a>
        )}
      </Container>
    </main>
  );
}
