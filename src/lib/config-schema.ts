export interface SiteConfig {
  siteName: string;
  siteDescription: string;
  tagline: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  socials: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  email: {
    fromName: string;
    fromEmail: string;
  };
  features: {
    enableRegistration: boolean;
    enableGallery: boolean;
    enableMembership: boolean;
    maintenanceMode: boolean;
  };
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
  footerText?: string;
}

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
  /** Bank details used for SEPA / cash membership payments. */
  bankName: string;
  iban: string;
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
  bankName: "{{BANK}}",
  iban: "{{IBAN}}",
};

export const defaultConfig: SiteConfig = {
  siteName: "Kerala Samajam Augsburg",
  siteDescription: "The official platform for the Kerala community in Augsburg, Germany.",
  tagline: "Connecting Hearts, Celebrating Culture",
  contactEmail: "info@ksaugsburg.de",
  socials: {
    facebook: "https://facebook.com/ksaugsburg",
    instagram: "https://instagram.com/ksaugsburg",
  },
  branding: {
    primaryColor: "#e11d48", // Rose 600
    secondaryColor: "#4f46e5", // Indigo 600
  },
  email: {
    fromName: "Kerala Samajam Augsburg",
    fromEmail: "no-reply@ksaugsburg.de",
  },
  features: {
    enableRegistration: true,
    enableGallery: true,
    enableMembership: true,
    maintenanceMode: false,
  },
  legal: defaultLegalEntity,
  footerText: "© 2024 Kerala Samajam Augsburg. All rights reserved.",
};
