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
  footerText?: string;
}

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
  footerText: "© 2024 Kerala Samajam Augsburg. All rights reserved.",
};
