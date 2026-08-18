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
import { organizationJsonLd } from "@/lib/structured-data";

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
    description: "Experience the vibrant culture and community of Kerala in Augsburg, Germany. Join us for events, celebrations, and togetherness.",
    keywords: ["Kerala Samajam", "Augsburg", "Malayali", "Germany", "KSA", "Indian Community", "Kerala Events"],
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
      description: "Kerala Samajam Augsburg (KSA) - Your Malayali home in Augsburg.",
      siteName: "KSA",
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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
