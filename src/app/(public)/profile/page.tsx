import { getServerSession } from "next-auth";
import { publicAuthOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileClient from "@/components/public/profile-client";

export const metadata = {
  title: "My Profile | Kerala Samajam Augsburg",
  description: "Manage your membership and event registrations.",
};

export default async function ProfilePage() {
  const session = await getServerSession(publicAuthOptions);

  if (!session?.user) {
    redirect("/membership");
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id as string },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
    }
  });

  if (!user) {
    redirect("/");
  }

  // Get registrations for this user
  const registrations = await prisma.registration.findMany({
    where: { email: user.email || "" },
    include: { event: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <ProfileClient 
      user={user} 
      subscriptions={user.subscriptions}
      registrations={registrations}
    />
  );
}
