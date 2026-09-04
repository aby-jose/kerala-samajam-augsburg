import type { Metadata } from "next";
import { getConfig } from "@/lib/config-utils";
import { qrTarget } from "@/lib/ceremony-showcase";
import { LaunchCeremony } from "@/components/launch/launch-ceremony";

export const metadata: Metadata = {
  title: "Official Website Launch Ceremony | Kerala Samajam Augsburg",
  description:
    "Official launch and unveiling ceremony for Kerala Samajam Augsburg (KSA).",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const config = await getConfig();

  // Resolved here, on the server, and handed down. `qrTarget()` reads
  // `siteUrl()`, which falls back to `SITE_URL` — and Next.js only inlines
  // `NEXT_PUBLIC_*` into the client bundle, so that half of the lookup can
  // never work in a browser. Called from the client components this deployment
  // would produce no QR at all: only `SITE_URL` is set here.
  const qr = qrTarget();

  return <LaunchCeremony config={config} qr={qr} />;
}
