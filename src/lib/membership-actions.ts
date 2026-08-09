"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { membershipPlanSchema, type MembershipPlanFormValues } from "./schemas";
import { stripe } from "./stripe";
import { addYears } from "date-fns";
import { getServerSession } from "next-auth";
import { publicAuthOptions, adminAuthOptions } from "./auth";
import { sendEmail } from "./email";
import { 
  getMembershipApplicationEmail, 
  getAdminNotificationEmail, 
  getApprovalEmail, 
  getRejectionEmail 
} from "./email-templates";
import { getConfig } from "./config-utils";

export async function getMembershipPlans() {
  return await prisma.membershipPlan.findMany({
    orderBy: { price: 'asc' }
  });
}

export async function getActiveMembershipPlans() {
  return await prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { price: 'asc' }
  });
}

export async function upsertMembershipPlan(data: MembershipPlanFormValues) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const validated = membershipPlanSchema.parse(data);
  const { id, ...planData } = validated;

  if (planData.isPopular) {
    await prisma.membershipPlan.updateMany({
      where: id ? { id: { not: id } } : {},
      data: { isPopular: false }
    });
  }

  if (id) {
    await prisma.membershipPlan.update({
      where: { id },
      data: planData,
    });
  } else {
    await prisma.membershipPlan.create({
      data: planData,
    });
  }

  revalidatePath("/admin/membership");
  revalidatePath("/membership");
  return { success: true };
}

export async function deleteMembershipPlan(id: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const subscriptionCount = await prisma.subscription.count({
    where: { planId: id }
  });

  if (subscriptionCount > 0) {
    await prisma.membershipPlan.update({
      where: { id },
      data: { isActive: false }
    });
    return { success: true, message: "Plan deactivated as it has active subscriptions." };
  }

  await prisma.membershipPlan.delete({
    where: { id },
  });
  
  revalidatePath("/admin/membership");
  return { success: true };
}

export async function togglePlanStatus(id: string, isActive: boolean) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  await prisma.membershipPlan.update({
    where: { id },
    data: { isActive },
  });
  
  revalidatePath("/admin/membership");
  revalidatePath("/membership");
  return { success: true };
}

export async function checkCurrentMemberStatus() {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) return { isMember: false };

  const sub = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id as string,
      status: { in: ["ACTIVE", "PENDING_VERIFICATION", "APPROVED_PENDING_PAYMENT", "PENDING", "REJECTED"] },
      endDate: { gte: new Date() }
    },
    include: { plan: true }
  });

  return {
    isMember: !!sub && sub.status === "ACTIVE",
    hasPending: !!sub && sub.status !== "ACTIVE",
    status: sub?.status || null,
    plan: sub?.plan || null
  };
}

export async function getDetailedMemberStatus() {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { 
      emailVerified: true,
      address: true,
      city: true,
      zip: true
    }
  });

  const sub = await prisma.subscription.findFirst({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
    include: { plan: true }
  });

  return {
    emailVerified: !!user?.emailVerified,
    addressComplete: !!(user?.address && user?.city && user?.zip),
    address: {
      street: user?.address || "",
      city: user?.city || "",
      zip: user?.zip || ""
    },
    subscription: sub
  };
}

export async function createMembershipSubscription(data: {
  planId: string;
  paymentMethod: "STRIPE" | "CASH";
  details?: any;
}) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: data.planId }
  });

  if (!plan) throw new Error("Plan not found");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string }
  });

  if (!user?.address || !user?.city || !user?.zip) {
    throw new Error("ADDRESS_REQUIRED");
  }

  const isStudentPlan = plan.name.toLowerCase().includes("student");

  if (isStudentPlan) {
    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id as string,
        planId: data.planId,
        paymentMethod: "NOT_SELECTED",
        paymentStatus: "PENDING",
        status: "PENDING_VERIFICATION",
        isApproved: false,
        startDate: new Date(),
        endDate: addYears(new Date(), 1),
        details: data.details || {},
      }
    });

    // Notify Member
    const config = await getConfig();
    await sendEmail({
       to: session.user.email!,
       subject: `We've received your student membership application - ${config.siteName}`,
       html: getMembershipApplicationEmail(plan.name, { 
         logoUrl: config.branding.logoUrl, 
         siteName: config.siteName,
         primaryColor: config.branding.primaryColor
       })
    });

    // Notify Admin
    const adminEmail = process.env.ADMIN_EMAIL || "admin@keralasamajam.de";
    await sendEmail({
       to: adminEmail,
       subject: `New Student Verification Request - ${config.siteName}`,
       html: getAdminNotificationEmail(session.user.name || "A member", plan.name, { 
         logoUrl: config.branding.logoUrl, 
         siteName: config.siteName,
         primaryColor: config.branding.primaryColor
       })
    });

    revalidatePath("/profile");
    return { success: true, method: "PENDING", subscriptionId: subscription.id };
  }

  // CASH for non-student (manual approval)
  if (data.paymentMethod === "CASH") {
    const subscription = await prisma.subscription.create({
      data: {
        userId: session.user.id as string,
        planId: data.planId,
        paymentMethod: "CASH",
        paymentStatus: "PENDING",
        status: "PENDING",
        isApproved: false,
        startDate: new Date(),
        endDate: addYears(new Date(), 1),
        details: data.details || {},
      }
    });

    revalidatePath("/profile");
    return { success: true, method: "CASH", subscriptionId: subscription.id };
  }

  // Regular Stripe Flow
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "sepa_debit"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `KSA Membership: ${plan.name}`,
            description: plan.description || undefined,
          },
          unit_amount: Math.round(plan.price * 100),
          recurring: {
            interval: "year",
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${baseUrl}/profile?success=membership`,
    cancel_url: `${baseUrl}/membership?canceled=true`,
    metadata: {
      userId: session.user.id as string,
      planId: data.planId,
      type: "membership",
      details: data.details ? JSON.stringify(data.details) : "{}"
    }
  });

  return { success: true, method: "STRIPE", url: checkoutSession.url };
}

export async function initiateSubscriptionPayment(subscriptionId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true }
  });

  if (!sub || sub.userId !== session.user.id) throw new Error("Subscription not found");
  
  if (!sub.user.address || !sub.user.city || !sub.user.zip) {
    throw new Error("ADDRESS_REQUIRED");
  }

  if (!sub.isApproved && sub.plan.name.toLowerCase().includes("student")) {
    throw new Error("Student verification still pending review.");
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card", "sepa_debit"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `KSA Membership: ${sub.plan.name}`,
            description: sub.plan.description || undefined,
          },
          unit_amount: Math.round(sub.plan.price * 100),
          recurring: {
            interval: "year",
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${baseUrl}/profile?success=membership`,
    cancel_url: `${baseUrl}/profile?canceled=true`,
    metadata: {
      userId: session.user.id as string,
      planId: sub.planId,
      subscriptionId: sub.id,
      type: "membership_payment"
    }
  });

  return { success: true, url: checkoutSession.url };
}

export async function cancelSubscription(subscriptionId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true }
  });

  if (!sub || sub.userId !== session.user.id) throw new Error("Subscription not found");
  if (!sub.stripeSubscriptionId) throw new Error("Only Stripe subscriptions can be cancelled online.");

  // Cancel in Stripe at period end
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Update in DB
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "CANCELLED_AT_PERIOD_END",
    }
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function approveMembership(subscriptionId: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true }
  });

  if (!sub) throw new Error("Subscription not found");

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      isApproved: true,
      status: sub.paymentMethod === "CASH" ? "ACTIVE" : "APPROVED_PENDING_PAYMENT",
      paymentStatus: sub.paymentMethod === "CASH" ? "PAID" : "PENDING",
    }
  });

  // Notify Member
  if (sub.user.email) {
     const config = await getConfig();
     await sendEmail({
        to: sub.user.email,
        subject: `Your student status has been verified! - ${config.siteName}`,
        html: getApprovalEmail(sub.plan.name, { 
          logoUrl: config.branding.logoUrl, 
          siteName: config.siteName,
          primaryColor: config.branding.primaryColor
        })
     });
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/membership/applications");
  revalidatePath("/profile");
  return { success: true };
}

export async function rejectMembership(subscriptionId: string, reason?: string) {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true }
  });

  if (!sub) throw new Error("Subscription not found");

  // Notify Member BEFORE updating, so we don't lose the record if email fails
  if (sub.user.email) {
     const config = await getConfig();
     await sendEmail({
        to: sub.user.email,
        subject: `Update regarding your membership application - ${config.siteName}`,
        html: getRejectionEmail(sub.plan.name, reason, { 
          logoUrl: config.branding.logoUrl, 
          siteName: config.siteName,
          primaryColor: config.branding.primaryColor
        })
     });
  }

  // Update status and store reason in details
  const details = (sub.details as any) || {};
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "REJECTED",
      details: {
        ...details,
        rejectionReason: reason || "Documents could not be verified."
      }
    }
  });

  revalidatePath("/admin/membership/applications");
  revalidatePath("/profile");
  return { success: true };
}

export async function resetRejectedSubscription(subscriptionId: string) {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.subscription.delete({
    where: { 
      id: subscriptionId,
      userId: session.user.id as string,
      status: "REJECTED"
    }
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function getPendingSubscriptions() {
  let session = await getServerSession(adminAuthOptions);
  if (!session) session = await getServerSession(publicAuthOptions);
  if ((session?.user as any)?.role !== "ADMIN") throw new Error("Unauthorized");

  return await prisma.subscription.findMany({
    where: {
      OR: [
        { status: "PENDING_VERIFICATION" },
        { status: "PENDING" },
        { isApproved: false }
      ]
    },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      },
      plan: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAllMembers() {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  const adminEmail = process.env.ADMIN_EMAIL || "ajmoviezone1@gmail.com";

  const users = await prisma.user.findMany({
    where: {
      email: { not: adminEmail }
    },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    emailVerified: user.emailVerified,
    joinedAt: user.createdAt,
    status: user.role.startsWith("SUSPENDED_") ? "SUSPENDED" : "ACTIVE",
    phone: user.phone,
    address: user.address,
    city: user.city,
    zip: user.zip,
    dob: user.dob,
    occupation: user.occupation,
    bio: user.bio,
    subscription: user.subscriptions[0] || null,
    allSubscriptions: user.subscriptions
  }));
}

export async function suspendUser(userId: string, currentStatus: string) {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  let newRole = user.role;
  if (currentStatus === "ACTIVE") {
    newRole = `SUSPENDED_${user.role}`;
  } else {
    newRole = user.role.replace("SUSPENDED_", "");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  revalidatePath("/admin/members");
  return { success: true, status: newRole.startsWith("SUSPENDED_") ? "SUSPENDED" : "ACTIVE" };
}

export async function updateMemberDetails(userId: string, data: { 
  name?: string; 
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  dob?: string | Date;
  occupation?: string;
  bio?: string;
  role?: string;
}) {
  const session = await getServerSession(adminAuthOptions);
  if (!session) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const updateData: any = { ...data };
  if (data.dob) updateData.dob = new Date(data.dob);

  await prisma.user.update({
    where: { id: userId },
    data: updateData
  });

  revalidatePath("/admin/members");
  return { success: true };
}
