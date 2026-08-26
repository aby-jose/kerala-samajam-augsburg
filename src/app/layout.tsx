import type { Metadata, Viewport } from "next";
import { Newsreader, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getConfig } from "@/lib/config-utils";
import { hexToHsl } from "@/lib/color-utils";
import { siteUrl } from "@/lib/site-url";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

// A function rather than a static object because the favicon is an admin
// setting and has to be read per request. The rest of the metadata is left
// hardcoded on purpose — `siteName` and `siteDescription` are config-driven
// but the page title, keywords and Open Graph copy are tuned for search and
// are not the same strings.
export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await getConfig();
  const url = siteUrl();

  return {
    metadataBase: url ? new URL(url) : undefined,
    title: "Kerala Samajam Augsburg (KSA) | Malayali Community in Germany",
    description:
      "Kerala Samajam Augsburg (KSA) — the Malayali and Mallu community in Augsburg, Bavaria. Onam, Vishu and Kerala celebrations, cultural events and community support in Germany.",
    keywords: [
      "Kerala Samajam",
      "Augsburg",
      "Malayali",
      "Mallu",
      "Malayalis in Germany",
      "Mallu community Germany",
      "Malayalee Samajam",
      "Bavaria",
      "Germany",
      "KSA",
      "Indian Community",
      "Kerala Events",
    ],
    authors: [{ name: "KSA Team" }],
    // Points every URL variant (bare domain, http) at the one canonical
    // address, so a crawler that reaches the site a different way doesn't
    // index it as a separate, competing page.
    alternates: url ? { canonical: url } : undefined,
    // Next serves `app/favicon.ico` by convention when `icons` is absent; naming
    // it explicitly here keeps that same file as the fallback once the key exists.
    icons: { icon: branding.faviconUrl || "/favicon.ico" },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url,
      title: "Kerala Samajam Augsburg (KSA)",
      description: "The Malayali — and Mallu — community's home in Augsburg, Bavaria.",
      siteName: "KSA",
      // The branding logo, not a photo — recognisable in a link preview even
      // before the site's own visual identity is familiar.
      images: ["/images/logo.png"],
    },
    // No OG block above meant no Twitter card either — a link shared there
    // fell back to a bare title with no image. summary_large_image mirrors
    // the Open Graph copy so both platforms preview the same thing.
    twitter: {
      card: "summary_large_image",
      title: "Kerala Samajam Augsburg (KSA)",
      description: "The Malayali — and Mallu — community's home in Augsburg, Bavaria.",
      images: ["/images/logo.png"],
    },
  };
}

// Light-only site — one theme colour, regardless of the OS setting.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The admin-configured brand colour is written onto <html> during the server
  // render so the very first paint already uses it. Applying it from a client
  // effect instead would flash the globals.css default until hydration.
  const config = await getConfig();
  const primaryHsl = hexToHsl(config.branding.primaryColor);
  const brandVars = primaryHsl
    ? ({ "--primary": primaryHsl, "--ring": primaryHsl } as React.CSSProperties)
    : undefined;
  const website = websiteJsonLd(config, siteUrl());

  return (
    <html lang="en" style={brandVars} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn("min-h-screen bg-background font-sans antialiased scroll-smooth", manrope.variable, newsreader.variable)}
      >
        {/* One Organization record for the whole site — tells Google this is
            a real Verein in Augsburg, not just a page of text. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd(config, siteUrl())),
          }}
        />
        {website && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
          />
        )}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
