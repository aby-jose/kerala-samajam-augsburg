import type { Metadata, Viewport } from "next";
import { Newsreader, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { getConfig } from "@/lib/config-utils";
import { hexToHsl } from "@/lib/color-utils";

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

export const metadata: Metadata = {
  title: "Kerala Samajam Augsburg (KSA) | Malayali Community in Germany",
  description: "Experience the vibrant culture and community of Kerala in Augsburg, Germany. Join us for events, celebrations, and togetherness.",
  keywords: ["Kerala Samajam", "Augsburg", "Malayali", "Germany", "KSA", "Indian Community", "Kerala Events"],
  authors: [{ name: "KSA Team" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://ksaugsburg.de",
    title: "Kerala Samajam Augsburg (KSA)",
    description: "Kerala Samajam Augsburg (KSA) - Your Malayali home in Augsburg.",
    siteName: "KSA",
  },
};

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
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
