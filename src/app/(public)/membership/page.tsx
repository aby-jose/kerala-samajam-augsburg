import { getActiveMembershipPlans } from "@/lib/membership-actions";
import MembershipClient from "@/components/public/membership-client";

export const metadata = {
  title: "Membership | Kerala Samajam Augsburg",
  description: "Join the KSA family and become a part of the vibrant Malayali community in Augsburg.",
};

export default async function MembershipPage() {
  const plans = await getActiveMembershipPlans();
  
  return <MembershipClient plans={plans} />;
}
