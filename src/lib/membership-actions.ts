"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { membershipPlanSchema, type MembershipPlanFormValues } from "./schemas";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { requirePermission, requireUser } from "./guards";
import { assertFeature } from "./feature-gate";
import { describeAudit } from "./rbac/audit";
import { assertAssignable, LockoutError } from "./rbac/lockout";
import { superAdminCount } from "./rbac/staff-queries";
import { sendMail, templates } from "./email";
import { getConfig } from "./config-utils";
import { adminEmail, adminEmailOrNull } from "./admin-contact";
import { recordDocumentConsents } from "./consent-recorder";
import {
  PAYMENT_METHODS,
  PENDING_STATUSES,
  SUBSCRIPTION_STATUS,
  isPaymentMethod,
  paymentReferenceFor,
  termEnd,
  type PaymentMethod,
} from "./membership-term";
import { sendMembershipPaymentRequest, sendSubscriptionReceipt } from "./invoice-actions";

/**
 * Every plan, including deactivated ones — the admin plans table.
 * The public site uses `getActiveMembershipPlans` below.
 */
export async function getMembershipPlans() {
  await requirePermission("membership.plans.view");

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
  await requirePermission("membership.plans.edit");

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
  await requirePermission("membership.plans.delete");

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
  await requirePermission("membership.plans.edit");

  await prisma.membershipPlan.update({
    where: { id },
    data: { isActive },
  });
  
  revalidatePath("/admin/membership");
  revalidatePath("/membership");
  return { success: true };
}

/**
 * Is this member currently a member, and if not, are they waiting on us?
 *
 * The two questions are asked separately on purpose. The single query this
 * replaces filtered on `endDate >= now`, which silently excluded every
 * application that has not been paid for — those now carry no `endDate` at
 * all — so `hasPending` could never be true and an applicant was shown the
 * join form again.
 */
export async function checkCurrentMemberStatus() {
  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) return { isMember: false, hasPending: false, status: null, plan: null };

  const userId = session.user.id as string;

  const active = await prisma.subscription.findFirst({
    where: {
      userId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      endDate: { gte: new Date() },
    },
    include: { plan: true },
  });

  if (active) {
    return { isMember: true, hasPending: false, status: active.status, plan: active.plan };
  }

  const pending = await prisma.subscription.findFirst({
    where: { userId, status: { in: [...PENDING_STATUSES, SUBSCRIPTION_STATUS.REJECTED] } },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  return {
    isMember: false,
    hasPending: !!pending && pending.status !== SUBSCRIPTION_STATUS.REJECTED,
    status: pending?.status || null,
    plan: pending?.plan || null,
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

/**
 * Submit a membership application.
 *
 * Nothing about the term is decided here. The row is created with no
 * `startDate` and no `endDate`: the membership begins on the day an
 * administrator records the payment, and until then the applicant is not a
 * member. `paymentMethod` records only how they *intend* to pay.
 */
export async function createMembershipSubscription(data: {
  planId: string;
  paymentMethod?: PaymentMethod;
  details?: any;
}) {
  await assertFeature("enableMembership");

  const session = await getServerSession(publicAuthOptions);
  if (!session?.user?.id) throw new Error("Authentication required");

  const userId = session.user.id as string;

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: data.planId }
  });

  if (!plan) throw new Error("Plan not found");
  if (!plan.isActive) throw new Error("This plan is no longer available");

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.address || !user?.city || !user?.zip) {
    throw new Error("ADDRESS_REQUIRED");
  }

  // A second application while one is already open would leave two rows an
  // administrator has to choose between, and the member unsure which one their
  // transfer paid for.
  const open = await prisma.subscription.findFirst({
    where: {
      userId,
      OR: [
        { status: { in: PENDING_STATUSES } },
        { status: SUBSCRIPTION_STATUS.ACTIVE, endDate: { gte: new Date() } },
      ],
    },
  });
  if (open) throw new Error("You already have a membership application in progress.");

  const isStudentPlan = plan.name.toLowerCase().includes("student");
  const paymentMethod = isPaymentMethod(data.paymentMethod)
    ? data.paymentMethod
    : PAYMENT_METHODS.BANK_TRANSFER;

  // Record what the member agreed to at the versions live right now. A paid
  // membership is a distance contract, so the terms, the privacy policy and
  // the withdrawal instruction all have to be evidenced at this moment.
  try {
    await recordDocumentConsents(
      userId,
      isStudentPlan ? ["privacy", "terms"] : ["privacy", "terms", "withdrawal"],
      "membership"
    );
  } catch (consentError) {
    console.error("Failed to record membership consent:", consentError);
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: data.planId,
      paymentMethod,
      paymentStatus: "PENDING",
      // A student ID has to be checked before we ask anyone for money.
      status: isStudentPlan
        ? SUBSCRIPTION_STATUS.PENDING_VERIFICATION
        : SUBSCRIPTION_STATUS.AWAITING_PAYMENT,
      isApproved: !isStudentPlan,
      details: data.details || {},
    }
  });

  const memberName = session.user.name || user.name || "there";
  // Read out of the session once. Inside a closure TypeScript loses the
  // narrowing on `session.user`, and reaching back through the optional chain
  // in every template callback obscures what is actually being sent.
  const memberEmail = session.user.email || user.email || "";

  if (isStudentPlan) {
    // No payment instructions yet — they would be premature while the ID is
    // still unverified and the application may be refused.
    if (memberEmail) {
      await sendMail({
        template: "membership.student-application-received",
        to: memberEmail,
        entityId: subscription.id,
        build: (ctx) =>
          templates.membership.studentApplicationReceived(ctx, {
            name: memberName,
            planName: plan.name,
          }),
      });
    }

    await sendMail({
      template: "membership.application-admin-notice",
      to: adminEmail(),
      entityId: subscription.id,
      build: (ctx) =>
        templates.membership.applicationAdminNotice(ctx, {
          memberName,
          memberEmail: memberEmail || "unknown",
          planName: plan.name,
        }),
    });
  } else {
    // Acknowledge the application before demanding money for it. A standard
    // applicant previously went straight from the form to an invoice, so the
    // first thing the association ever said to a new member was a bill.
    if (memberEmail) {
      await sendMail({
        template: "membership.application-received",
        to: memberEmail,
        entityId: subscription.id,
        build: (ctx) =>
          templates.membership.applicationReceived(ctx, {
            name: memberName,
            planName: plan.name,
            amount: plan.price,
          }),
      });
    }

    // Email failure must not lose the application, which is already written.
    try {
      await sendMembershipPaymentRequest(subscription.id);
    } catch (mailError) {
      console.error("Failed to send payment request:", mailError);
    }
  }

  revalidatePath("/profile");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/membership/applications");

  return {
    success: true,
    status: subscription.status,
    subscriptionId: subscription.id,
  };
}

/**
 * Verify a student's identity document.
 *
 * Verification is not payment. This used to activate a cash membership
 * outright, which meant a member could be active having paid nothing; all it
 * does now is move the application on to awaiting payment and send the
 * payment instructions that were withheld until the ID was checked.
 */
export async function approveMembership(subscriptionId: string) {
  await requirePermission("membership.applications.approve");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true }
  });

  if (!sub) throw new Error("Subscription not found");
  if (sub.paymentStatus === "PAID") throw new Error("This membership is already paid and active.");

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      isApproved: true,
      status: SUBSCRIPTION_STATUS.AWAITING_PAYMENT,
    }
  });

  if (sub.user.email) {
    await sendMail({
      template: "membership.student-verified",
      to: sub.user.email,
      entityId: sub.id,
      build: (ctx) =>
        templates.membership.studentVerified(ctx, {
          name: sub.user.name || "there",
          planName: sub.plan.name,
        }),
    });
  }

  try {
    await sendMembershipPaymentRequest(subscriptionId);
  } catch (mailError) {
    console.error("Failed to send payment request:", mailError);
  }

  revalidatePath("/admin/membership");
  revalidatePath("/admin/membership/applications");
  revalidatePath("/admin/payments");
  revalidatePath("/profile");
  return { success: true };
}

/**
 * Record that a membership payment arrived — the one action that starts a
 * membership term.
 *
 * `receivedOn` is the day the money actually arrived and may be backdated, so
 * cash handed over at last month's event produces the term the member
 * actually bought. `recordedAt` separately captures when an administrator
 * pressed the button, which is the fact that cannot be restated.
 */
export async function recordSubscriptionPayment(
  subscriptionId: string,
  input: {
    receivedOn?: string | Date;
    method?: PaymentMethod;
    reference?: string;
    note?: string;
  } = {}
) {
  const admin = await requirePermission("payments.record");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true },
  });

  if (!sub) throw new Error("Subscription not found");
  if (sub.paymentStatus === "PAID") throw new Error("This payment has already been recorded.");
  if (sub.status === SUBSCRIPTION_STATUS.REJECTED) {
    throw new Error("This application was rejected. Reopen it before recording a payment.");
  }
  if (sub.status === SUBSCRIPTION_STATUS.PENDING_VERIFICATION) {
    throw new Error("Verify the student ID before recording a payment.");
  }

  const receivedOn = input.receivedOn ? new Date(input.receivedOn) : new Date();
  if (Number.isNaN(receivedOn.getTime())) throw new Error("Invalid payment date");

  // A term cannot start in the future: it would leave the member neither
  // active nor awaiting payment, and the profile page has no state for that.
  if (receivedOn.getTime() > Date.now()) {
    throw new Error("The payment date cannot be in the future.");
  }

  const method = isPaymentMethod(input.method) ? input.method : (sub.paymentMethod as PaymentMethod);

  await describeAudit({
    summary: `Recorded ${sub.plan.price} ${sub.plan.name} payment for ${sub.user.name ?? sub.user.email}`,
    entity: "Subscription",
    entityId: sub.id,
    metadata: { paymentReference: input.reference?.trim() || null, paymentMethod: method },
  });

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      paymentStatus: "PAID",
      paymentMethod: method,
      isApproved: true,
      startDate: receivedOn,
      endDate: termEnd(receivedOn, sub.plan.duration),
      paymentReference: input.reference?.trim() || null,
      paymentNote: input.note?.trim() || null,
      recordedById: admin.id,
      recordedAt: new Date(),
    },
  });

  // Two emails, because they do different jobs. The receipt is a financial
  // record with the invoice PDF attached; the welcome is the one that tells a
  // new member what they have actually joined. A renewal gets a shorter note
  // instead — someone in their third year does not need onboarding again.
  try {
    await sendSubscriptionReceipt(subscriptionId);
  } catch (mailError) {
    console.error("Failed to send membership receipt:", mailError);
  }

  if (sub.user.email) {
    const previousTerms = await prisma.subscription.count({
      where: {
        userId: sub.userId,
        id: { not: sub.id },
        paymentStatus: "PAID",
      },
    });

    const endDate = termEnd(receivedOn, sub.plan.duration);

    await sendMail({
      template: previousTerms > 0 ? "membership.renewed" : "membership.active",
      to: sub.user.email,
      entityId: sub.id,
      once: true,
      build: (ctx) =>
        previousTerms > 0
          ? templates.membership.membershipRenewed(ctx, {
              name: sub.user.name || "there",
              planName: sub.plan.name,
              startDate: receivedOn,
              endDate,
            })
          : templates.membership.membershipActive(ctx, {
              name: sub.user.name || "there",
              planName: sub.plan.name,
              startDate: receivedOn,
              endDate,
              features: sub.plan.features,
            }),
    });
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/members");
  revalidatePath("/admin/membership/applications");
  revalidatePath("/profile");
  return { success: true };
}

/**
 * Undo a payment that was recorded against the wrong member or the wrong row.
 *
 * The term dates go with it — leaving them would keep the membership active
 * on a payment we have just said did not happen.
 */
export async function revertSubscriptionPayment(subscriptionId: string, reason?: string) {
  const admin = await requirePermission("payments.revert");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: true },
  });
  if (!sub) throw new Error("Subscription not found");
  if (sub.paymentStatus !== "PAID") throw new Error("No recorded payment to undo.");

  const details = (sub.details as any) || {};

  await describeAudit({
    summary: `Reversed the payment on ${sub.user.name ?? sub.user.email}'s membership`,
    entity: "Subscription",
    entityId: sub.id,
    metadata: { reason: reason ?? null },
  });

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SUBSCRIPTION_STATUS.AWAITING_PAYMENT,
      paymentStatus: "PENDING",
      startDate: null,
      endDate: null,
      paymentReference: null,
      recordedById: null,
      recordedAt: null,
      details: {
        ...details,
        paymentReversals: [
          ...(Array.isArray(details.paymentReversals) ? details.paymentReversals : []),
          { at: new Date().toISOString(), by: admin.email || admin.id, reason: reason || null },
        ],
      },
    },
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/members");
  revalidatePath("/profile");
  return { success: true };
}

/**
 * End a membership early. There is no recurring charge to stop, so this is
 * purely a record that the term no longer runs.
 */
export async function cancelSubscriptionAsAdmin(subscriptionId: string, reason?: string) {
  const admin = await requirePermission("membership.applications.cancel");

  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new Error("Subscription not found");

  const details = (sub.details as any) || {};

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SUBSCRIPTION_STATUS.CANCELLED,
      endDate: new Date(),
      details: {
        ...details,
        cancellation: {
          at: new Date().toISOString(),
          by: admin.email || admin.id,
          reason: reason || null,
        },
      },
    },
  });

  revalidatePath("/admin/members");
  revalidatePath("/admin/payments");
  revalidatePath("/profile");
  return { success: true };
}

export async function rejectMembership(subscriptionId: string, reason?: string) {
  await requirePermission("membership.applications.approve");

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, user: true }
  });

  if (!sub) throw new Error("Subscription not found");

  // Notify Member BEFORE updating, so we don't lose the record if email fails
  if (sub.user.email) {
    await sendMail({
      template: "membership.application-rejected",
      to: sub.user.email,
      entityId: sub.id,
      build: (ctx) =>
        templates.membership.applicationRejected(ctx, {
          name: sub.user.name || "there",
          planName: sub.plan.name,
          reason: reason?.trim() || undefined,
        }),
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
  const user = await requireUser();

  await prisma.subscription.delete({
    where: {
      id: subscriptionId,
      userId: user.id,
      status: SUBSCRIPTION_STATUS.REJECTED
    }
  });

  revalidatePath("/profile");
  return { success: true };
}

/**
 * Everything an administrator still has to act on: IDs to verify and payments
 * to record.
 *
 * The old `{ isApproved: false }` clause is gone — it was true for every
 * rejected application too, so refusals kept reappearing in the queue.
 */
export async function getPendingSubscriptions() {
  await requirePermission("membership.applications.view");

  return await prisma.subscription.findMany({
    where: { status: { in: PENDING_STATUSES } },
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

/**
 * What the signed-in member needs in order to pay: the amount, the bank
 * details and the reference to quote.
 *
 * This replaces the "Pay now" button that used to open a checkout session.
 */
export async function getMembershipPaymentDetails() {
  const user = await requireUser();

  const sub = await prisma.subscription.findFirst({
    where: { userId: user.id, status: SUBSCRIPTION_STATUS.AWAITING_PAYMENT },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  if (!sub) return null;

  const config = await getConfig();

  return {
    subscriptionId: sub.id,
    planName: sub.plan.name,
    amount: sub.plan.price,
    duration: sub.plan.duration,
    method: sub.paymentMethod,
    appliedAt: sub.createdAt,
    reference: paymentReferenceFor(sub.id, user.name),
    bank: {
      accountHolder: config.legal.accountHolder,
      bankName: config.legal.bankName,
      iban: config.legal.iban,
      bic: config.legal.bic,
      termsDays: config.legal.paymentTermsDays,
    },
  };
}

export async function getAllMembers() {
  await requirePermission("members.view");

  const notifyAddress = adminEmailOrNull();

  const users = await prisma.user.findMany({
    where: {
      email: { not: notifyAddress }
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
  const admin = await requirePermission("members.suspend");

  // Suspending yourself locks the last administrator out of the panel with no
  // way back in through the UI.
  if (admin.id === userId) {
    throw new Error("You cannot suspend your own account.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staffRole: { select: { isSystem: true } } },
  });
  if (!user) throw new Error("User not found");

  let newRole = user.role;
  if (currentStatus === "ACTIVE") {
    newRole = `SUSPENDED_${user.role}`;
  } else {
    newRole = user.role.replace("SUSPENDED_", "");
  }

  const nextStatus = newRole.startsWith("SUSPENDED_") ? "SUSPENDED" : "ACTIVE";

  // Lockout rule 2 (spec §10.2): the last Super Admin cannot be demoted,
  // revoked, or suspended. Only checked on the way into suspension — a
  // reinstatement can never be the move that strands the committee.
  if (nextStatus === "SUSPENDED") {
    try {
      assertAssignable({
        actorId: admin.id,
        targetId: user.id,
        targetIsSuperAdmin: user.staffRole?.isSystem ?? false,
        remainingSuperAdmins: await superAdminCount(),
      });
    } catch (error) {
      if (error instanceof LockoutError) return { error: error.message };
      throw error;
    }
  }

  // Suspension is another way an admin can lose access abruptly — the same
  // reason `revokeStaffAccess` burns outstanding invites. Two directions
  // matter here: an invite already addressed to this person (so a link they
  // already hold can't be used to clear the suspension the moment it's
  // accepted — `acceptInvite` also refuses a suspended account itself, but
  // the two can race, and this is the side that closes the window rather
  // than just detecting it) and, if they were staff themselves, any invite
  // they had issued. Done before the role write below, not after: if this
  // throws, the account is not yet suspended and a retry re-enters normally,
  // instead of stranding a suspension whose invites were never revoked.
  let revokedForThem = 0;
  let revokedByThem = 0;
  if (nextStatus === "SUSPENDED") {
    if (user.email) {
      const forThem = await prisma.staffInvite.updateMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      revokedForThem = forThem.count;
    }

    const byThem = await prisma.staffInvite.updateMany({
      where: { invitedById: userId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revokedByThem = byThem.count;
  }

  const invitePart = [
    revokedForThem > 0
      ? `${revokedForThem} pending invitation${revokedForThem === 1 ? "" : "s"} sent to them`
      : null,
    revokedByThem > 0
      ? `${revokedByThem} pending invitation${revokedByThem === 1 ? "" : "s"} they had sent`
      : null,
  ]
    .filter(Boolean)
    .join(" and ");

  await describeAudit({
    summary:
      `${nextStatus === "ACTIVE" ? "Reinstated" : "Suspended"} ${user.email}` +
      (invitePart ? ` and revoked ${invitePart}` : ""),
    entity: "User",
    entityId: user.id,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  revalidatePath("/admin/members");
  return { success: true, status: nextStatus };
}

/**
 * Fields an administrator may edit on someone else's account.
 *
 * Spelled out as a schema rather than spread from the caller: this action used
 * to pass `{ ...data }` straight into `prisma.user.update`, so anything the
 * client sent was written — `role` included, and `password` or `emailVerified`
 * had it occurred to anyone to send them.
 *
 * `role` is deliberately not a field here. Staff role changes go through
 * `changeStaffRole` (staff-actions.ts) under `staff.manage`, which applies the
 * last-Super-Admin lockout rule and keeps `role`/`staffRoleId` in step. This
 * schema used to accept `role: z.enum(["MEMBER", "ADMIN"])` gated only by
 * `members.edit`, which could demote the sole Super Admin with no lockout
 * check, or promote a member to `role: "ADMIN"` with no `staffRoleId` — an
 * account that holds no permissions but can still reach an admin session.
 */
const memberDetailsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  dob: z.union([z.string(), z.date()]).optional(),
  occupation: z.string().max(120).optional(),
  bio: z.string().max(2000).optional(),
});

export type MemberDetailsInput = z.input<typeof memberDetailsSchema>;

export async function updateMemberDetails(userId: string, data: MemberDetailsInput) {
  await requirePermission("members.edit");

  const parsed = memberDetailsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid member details");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const { dob, ...rest } = parsed.data;
  const updateData: Prisma.UserUpdateInput = { ...rest };

  if (dob) updateData.dob = new Date(dob);

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  revalidatePath("/admin/members");
  return { success: true };
}
