import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin } from "lucide-react";
import { defaultConfig } from "@/lib/config-schema";
import { Container } from "./container";
import { cn } from "@/lib/utils";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted text-muted-foreground py-20 border-t border-border/50 transition-colors duration-500">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href="/" className="group mb-6 block">
              <div className="text-2xl font-sans font-semibold tracking-tight transition-colors duration-300 text-foreground">
                Kerala Samajam <span className="text-primary">&nbsp;Augsburg</span>
              </div>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm mb-8 text-muted-foreground font-light transition-colors">
              {defaultConfig.siteDescription || "Dedicated to preserving our heritage and fostering togetherness in the heart of Augsburg."}
            </p>
            <div className="flex items-center space-x-4">
              {[
                { icon: Facebook, href: defaultConfig.socials.facebook },
                { icon: Instagram, href: defaultConfig.socials.instagram },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white hover:border-transparent transition-all duration-300 shadow-sm"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Navigation</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">About Us</Link></li>
              <li><Link href="/events" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">Events</Link></li>
              <li><Link href="/gallery" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">Gallery</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Support</h4>
            <ul className="space-y-3">
              <li><Link href="/contact" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">Help Center</Link></li>
              <li><Link href="/privacy" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground hover:text-foreground">Terms of Use</Link></li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3 text-sm font-medium text-muted-foreground transition-colors">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span className="pt-0.5">{defaultConfig.address || "Augsburg, Germany"}</span>
              </li>
              <li className="flex items-center space-x-3 text-sm font-medium text-muted-foreground transition-colors">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <span>{defaultConfig.contactEmail}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground/60 font-medium tracking-wide transition-colors">
          <p>© {currentYear} {defaultConfig.siteName}. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
}
