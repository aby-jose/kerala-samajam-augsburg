export interface SiteConfig {
  siteName: string;
  siteDescription: string;
  tagline: string;
  /**
   * Four-digit founding year, shown on the membership cards and published as
   * the Organization's `foundingDate`. Blank means "not stated" — every reader
   * drops its clause rather than printing an empty year.
   */
  foundedYear?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  socials: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    whatsapp?: string;
  };
  branding: {
    /**
     * The single accent colour. Written onto `<html>` as `--primary` during the
     * server render in `app/layout.tsx`.
     *
     * There is deliberately no second brand colour. One existed here for a
     * while, with a picker on the settings screen, and nothing ever read it:
     * the only slot it could have filled is shadcn's `--secondary`, which is
     * the neutral grey behind secondary buttons and muted panels, so honouring
     * it would have tinted every quiet surface on the site.
     */
    primaryColor: string;
    logoUrl?: string;
    /** Browser-tab icon. Falls back to the bundled `/favicon.ico` when unset. */
    faviconUrl?: string;
  };
  email: {
    fromName: string;
    fromEmail: string;
    /**
     * Which of the scheduled email jobs (`/api/cron`) are allowed to send.
     *
     * Off means the job still runs on schedule and does its bookkeeping (a
     * membership past its end date is still marked EXPIRED) — it just skips
     * the `sendMail` call. That is deliberate: turning a notice off should
     * never leave the underlying record wrong, only silence the email.
     */
    automated: AutomatedEmailConfig;
    /**
     * Which action-triggered notifications are allowed to send — the mail
     * fired by something a member or admin does, as opposed to `automated`'s
     * cron jobs. Same rule as `automated`: off silences the email only, the
     * record it would have announced is written either way.
     */
    notifications: NotificationEmailConfig;
  };
  features: {
    enableRegistration: boolean;
    enableGallery: boolean;
    enableMembership: boolean;
    maintenanceMode: boolean;
  };
  /** Rules the membership application form enforces. */
  membership: MembershipConfig;
  /**
   * Structured legal facts about the association.
   *
   * These live in config rather than inside the legal prose because they
   * change on a different clock: a new treasurer is a settings edit, not a
   * new version of the Datenschutzerklärung. The document renderer
   * substitutes them as `{{legal.registerNumber}}` etc. at display time, so
   * updating them never triggers a re-consent prompt.
   */
  legal: LegalEntityConfig;
}

/**
 * One switch per scheduled email job in `/api/cron`. Keyed to match
 * `email-jobs.ts`, not to the underlying database records — `paymentReminders`
 * covers the overdue notice even though the job also runs `getConfig()` for
 * the payment terms, for example.
 */
export interface AutomatedEmailConfig {
  /** Event reminders at T-2 days and on the morning of. */
  eventReminders: boolean;
  /** Thank-you note the day after an event, with a link to the gallery. */
  postEventThankYou: boolean;
  /** Renewal notices at T-30 and T-7, and the notice a term has ended. */
  membershipLifecycle: boolean;
  /** Notices for membership fees whose due date has passed. */
  paymentReminders: boolean;
  /** Weekly summary of payments recorded and outstanding, to the committee. */
  adminDigest: boolean;
}

export const defaultAutomatedEmailConfig: AutomatedEmailConfig = {
  eventReminders: true,
  postEventThankYou: true,
  membershipLifecycle: true,
  paymentReminders: true,
  adminDigest: true,
};

/**
 * One switch per action-triggered notification, grouped the way the settings
 * screen shows them. Keyed to the `template` id passed to `sendMail` — see
 * `NOTIFICATION_TOGGLE` in `src/lib/email/send.ts`, which is the only other
 * place these keys need to be kept in sync.
 *
 * Security mail (verification, password reset, sign-in/email-change alerts)
 * and GDPR-mandated notices (export ready, deletion requested/cancelled/
 * completed) are deliberately not here — turning those off breaks a login
 * flow or leaves a legal notice obligation unmet, so they always send.
 */
export interface NotificationEmailConfig {
  /** Registration confirmation, with the ticket PDF attached. */
  eventTicket: boolean;
  /** A member cancels their own registration, or an admin removes one. */
  eventRegistrationChanges: boolean;
  /** An event is cancelled or reinstated — broadcast to every registrant. */
  eventCancelledBroadcast: boolean;
  /** An event's date or venue changes — broadcast to every registrant. */
  eventRescheduled: boolean;
  /** A registration is turned away because the event is full. */
  eventFull: boolean;
  /** A newly published event, announced to members who opted in. */
  eventAnnouncement: boolean;
  /** An event fee is recorded as paid, or that record is reversed. */
  eventPaymentUpdates: boolean;
  /** A membership application is received — member acknowledgement + admin notice. */
  membershipApplicationReceived: boolean;
  /** A student application is verified or rejected. */
  membershipApplicationDecision: boolean;
  /** A membership goes active or renews. */
  membershipActivation: boolean;
  /** A gallery contribution is submitted, approved, or rejected. */
  galleryContributions: boolean;
  /** The contact form's admin notice and sender acknowledgement. */
  contactForm: boolean;
}

export const defaultNotificationEmailConfig: NotificationEmailConfig = {
  eventTicket: true,
  eventRegistrationChanges: true,
  eventCancelledBroadcast: true,
  eventRescheduled: true,
  eventFull: true,
  eventAnnouncement: true,
  eventPaymentUpdates: true,
  membershipApplicationReceived: true,
  membershipApplicationDecision: true,
  membershipActivation: true,
  galleryContributions: true,
  contactForm: true,
};

/**
 * How large a family plan may be.
 *
 * The application form derives each added slot's relation from these: the
 * first `maxFamilyAdults` names are recorded as ADULT, everything after that
 * as CHILD, up to `maxFamilyChildren` of them. Raising a limit only affects
 * applications made from then on — a family already on file keeps the names
 * it was submitted with.
 */
export interface MembershipConfig {
  /** Adults a family plan covers, besides nobody — the applicant is one of them. */
  maxFamilyAdults: number;
  /** Children a family plan covers. */
  maxFamilyChildren: number;
}

export const defaultMembershipConfig: MembershipConfig = {
  maxFamilyAdults: 2,
  maxFamilyChildren: 5,
};

export interface LegalEntityConfig {
  /** Full registered name, e.g. "Kerala Samajam Augsburg e.V." */
  entityName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  /** Registergericht — the court holding the Vereinsregister. */
  registerCourt: string;
  /** Vereinsregister number, e.g. "VR 1234". */
  registerNumber: string;
  /** USt-IdNr. per § 27a UStG. Empty when the association has none. */
  vatId: string;
  /** Board members authorised to represent the association per § 26 BGB. */
  boardMembers: string[];
  /** Responsible for editorial content per § 18 Abs. 2 MStV. */
  responsiblePerson: string;
  responsiblePersonAddress: string;
  /** Datenschutzbeauftragter. Leave blank if none is appointed. */
  dpoName: string;
  dpoEmail: string;
  /** Competent supervisory authority for GDPR complaints. */
  supervisoryAuthority: string;
  /** Hosting provider, named in the privacy policy. */
  hostingProvider: string;

  // --- Bank details ------------------------------------------------------
  // Since there is no payment gateway, these are the only instructions a
  // member gets for how to pay. They are shown in the membership form, on the
  // profile page, in the payment-request email and on the invoice PDF — so
  // they are one source of truth rather than four hard-coded strings.
  /** Account holder as it appears on the account — not always `entityName`. */
  accountHolder: string;
  bankName: string;
  iban: string;
  bic: string;
  /** Days after which a membership payment is expected. Shown as a due date. */
  paymentTermsDays: number;
}

export const defaultLegalEntity: LegalEntityConfig = {
  entityName: "Kerala Samajam Augsburg e.V.",
  legalForm: "Eingetragener Verein (e.V.)",
  street: "{{STRASSE UND HAUSNUMMER}}",
  postalCode: "{{PLZ}}",
  city: "Augsburg",
  country: "Deutschland",
  registerCourt: "Amtsgericht Augsburg",
  registerNumber: "{{VR-NUMMER}}",
  vatId: "",
  boardMembers: ["{{NAME 1. VORSITZENDE:R}}", "{{NAME 2. VORSITZENDE:R}}"],
  responsiblePerson: "{{NAME VERANTWORTLICHE:R}}",
  responsiblePersonAddress: "{{ANSCHRIFT VERANTWORTLICHE:R}}",
  dpoName: "",
  dpoEmail: "",
  supervisoryAuthority:
    "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach",
  hostingProvider: "{{HOSTING-ANBIETER}}",
  accountHolder: "Kerala Samajam Augsburg e.V.",
  bankName: "{{BANK}}",
  iban: "{{IBAN}}",
  bic: "{{BIC}}",
  paymentTermsDays: 14,
};

export const defaultConfig: SiteConfig = {
  siteName: "Kerala Samajam Augsburg",
  siteDescription: "The official platform for the Malayali — Mallu — community in Augsburg, Bavaria, Germany.",
  tagline: "Connecting Hearts, Celebrating Culture",
  foundedYear: "2012",
  contactEmail: "info@ksaugsburg.de",
  socials: {
    facebook: "https://facebook.com/ksaugsburg",
    instagram: "https://instagram.com/ksaugsburg",
    whatsapp: "",
  },
  branding: {
    primaryColor: "#e11d48", // Rose 600
  },
  email: {
    fromName: "Kerala Samajam Augsburg",
    fromEmail: "no-reply@ksaugsburg.de",
    automated: defaultAutomatedEmailConfig,
    notifications: defaultNotificationEmailConfig,
  },
  features: {
    enableRegistration: true,
    enableGallery: true,
    enableMembership: true,
    maintenanceMode: false,
  },
  membership: defaultMembershipConfig,
  legal: defaultLegalEntity,
};
