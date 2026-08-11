import { addDays, addMonths, addYears } from "date-fns";

/**
 * Membership term arithmetic and status derivation.
 *
 * Pure and synchronous, so it is deliberately *not* in `membership-actions.ts`
 * — that file carries "use server" and may only export async functions. Both
 * server actions and client components read from here, which is the point:
 * "is this person a member right now" was previously answered by four slightly
 * different inline queries.
 */

export const SUBSCRIPTION_STATUS = {
  /** Student plan: identity document submitted, awaiting an administrator. */
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  /** Accepted. The term begins when an administrator records the payment. */
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  /** Payment recorded; the term is running. */
  ACTIVE: "ACTIVE",
  /** Student identity document refused. */
  REJECTED: "REJECTED",
  /** The term ran to its end. */
  EXPIRED: "EXPIRED",
  /** Ended early by an administrator. */
  CANCELLED: "CANCELLED",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

/** Statuses where the member has applied but the term has not started. */
export const PENDING_STATUSES: string[] = [
  SUBSCRIPTION_STATUS.PENDING_VERIFICATION,
  SUBSCRIPTION_STATUS.AWAITING_PAYMENT,
];

export const PAYMENT_METHODS = {
  BANK_TRANSFER: "BANK_TRANSFER",
  CASH: "CASH",
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === PAYMENT_METHODS.BANK_TRANSFER || value === PAYMENT_METHODS.CASH;
}

/**
 * The day a term ends, given the day it started.
 *
 * `MembershipPlan.duration` is a free-text string on the model, so anything
 * unrecognised falls back to a year — the duration every plan currently uses.
 */
export function termEnd(start: Date, duration: string | null | undefined): Date {
  switch ((duration || "").toUpperCase()) {
    case "MONTHLY":
      return addMonths(start, 1);
    case "QUARTERLY":
      return addMonths(start, 3);
    case "HALF_YEARLY":
    case "HALFYEARLY":
      return addMonths(start, 6);
    case "LIFETIME":
      return addYears(start, 100);
    case "YEARLY":
    default:
      return addYears(start, 1);
  }
}

/** Human-readable term length, for confirmation copy. */
export function termLabel(duration: string | null | undefined): string {
  switch ((duration || "").toUpperCase()) {
    case "MONTHLY":
      return "1 month";
    case "QUARTERLY":
      return "3 months";
    case "HALF_YEARLY":
    case "HALFYEARLY":
      return "6 months";
    case "LIFETIME":
      return "lifetime";
    default:
      return "1 year";
  }
}

/** When a membership payment is expected, given the application date. */
export function paymentDueDate(appliedAt: Date, termsDays: number): Date {
  return addDays(appliedAt, termsDays > 0 ? termsDays : 14);
}

type TermFields = {
  status: string;
  endDate?: Date | string | null;
};

/**
 * The status as it should be *displayed*.
 *
 * Nothing sweeps the database when a term lapses — there is no gateway sending
 * `customer.subscription.deleted` any more — so an ACTIVE row whose `endDate`
 * has passed is expired in every sense except the stored string. Read status
 * through this rather than off the row.
 */
export function displayStatus(sub: TermFields | null | undefined): string | null {
  if (!sub) return null;
  if (sub.status === SUBSCRIPTION_STATUS.ACTIVE && !isTermRunning(sub)) {
    return SUBSCRIPTION_STATUS.EXPIRED;
  }
  return sub.status;
}

/** True when the row is ACTIVE *and* its term has not yet run out. */
export function isTermRunning(sub: TermFields | null | undefined): boolean {
  if (!sub || sub.status !== SUBSCRIPTION_STATUS.ACTIVE) return false;
  if (!sub.endDate) return false;
  return new Date(sub.endDate).getTime() >= Date.now();
}

/** True while the member is waiting on verification or on us recording money. */
/**
 * The payment reference a member should quote on a transfer.
 *
 * Short, unambiguous and derived from the subscription id, so an administrator
 * reading a bank statement can find the row it belongs to.
 */
export function paymentReferenceFor(subscriptionId: string, name?: string | null): string {
  const code = subscriptionId.slice(-8).toUpperCase();
  const who = (name || "").trim().split(/\s+/)[0];
  return who ? `KSA-${code} ${who}` : `KSA-${code}`;
}
