import { getActiveMembershipPlans } from "@/lib/membership-actions";
import { requireFeature } from "@/lib/feature-gate";
import MembershipClient from "@/components/public/membership-client";

export const metadata = {
  title: "Membership | Kerala Samajam Augsburg",
  description: "Join the KSA family and become a part of the vibrant Malayali community in Augsburg.",
};

// Plans are edited from the admin panel and drive a payment flow, so they are
// read per request rather than baked in at build time.
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  await requireFeature("enableMembership");

  const plans = await getActiveMembershipPlans();
  
  return <MembershipClient plans={plans} />;
}
