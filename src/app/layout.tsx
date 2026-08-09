import type { Metadata, Viewport } from "next";
import { Newsreader, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
