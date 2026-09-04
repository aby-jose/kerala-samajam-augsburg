import type { Metadata } from "next";
import { getConfig } from "@/lib/config-utils";
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

  return <LaunchCeremony config={config} />;
}
