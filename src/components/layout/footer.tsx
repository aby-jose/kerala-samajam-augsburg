"use client";

import React from "react";
import Link from "next/link";
import { Cookie, Facebook, Instagram, Mail, MapPin } from "lucide-react";
import { useConfig } from "../providers/config-provider";
import { Container } from "./container";
import { LEGAL_DOCS_ORDERED } from "@/lib/legal-schema";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/components/legal/cookie-consent";
import { cn } from "@/lib/utils";

export function Footer() {
  const config = useConfig();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted text-muted-foreground py-20 border-t border-border/50 transition-colors duration-500">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href="/" className="group mb-6 flex items-center gap-3 transition-opacity hover:opacity-90">
              <img 
                src={config.branding.logoUrl || "/images/logo.png"} 
                alt={config.siteName} 
                className="h-14 w-auto"
              />
              <div className="text-xl font-sans font-semibold tracking-tight transition-colors duration-300 text-foreground">
                {config.siteName.split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    {i === config.siteName.split(" ").length - 1 ? (
                      <span className="text-primary">&nbsp;{word}</span>
                    ) : (
                      word + (i < config.siteName.split(" ").length - 1 ? " " : "")
                    )}
                  </React.Fragment>
                ))}
              </div>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm mb-8 text-muted-foreground font-light transition-colors">
              {config.siteDescription || "Dedicated to preserving our heritage and fostering togetherness."}
            </p>
            <div className="flex items-center space-x-4">
              {[
                { icon: Facebook, href: config.socials.facebook },
                { icon: Instagram, href: config.socials.instagram },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border border-transparent bg-primary flex items-center justify-center text-white shadow-sm hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md transition-all duration-300"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Navigation</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground">About Us</Link></li>
              <li><Link href="/events" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground">Events</Link></li>
              <li><Link href="/membership" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground">Membership</Link></li>
              <li><Link href="/gallery" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground">Gallery</Link></li>
              <li><Link href="/contact" className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground">Help Center</Link></li>
            </ul>
          </div>

          {/*
            German law expects the Impressum to be reachable in at most two
            clicks and labelled as such, so the whole set lives here rather
            than behind a single "Legal" page.
          */}
          <div className="lg:col-span-2">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Legal</h4>
            <ul className="space-y-3">
              {LEGAL_DOCS_ORDERED.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={`/legal/${doc.slug}`}
                    className="hover:text-primary transition-colors text-sm font-medium text-muted-foreground"
                  >
                    {doc.label.en}
                  </Link>
                </li>
              ))}
              <li>
                {/* Withdrawing consent has to be as easy as giving it. */}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors text-sm font-medium text-muted-foreground"
                >
                  <Cookie className="h-3.5 w-3.5" />
                  Cookie settings
                </button>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="text-foreground font-semibold mb-6 font-serif tracking-tight transition-colors">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3 text-sm font-medium text-muted-foreground transition-colors">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span className="pt-0.5">{config.address || "Augsburg, Germany"}</span>
              </li>
              <li className="flex items-center space-x-3 text-sm font-medium text-muted-foreground transition-colors">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <span>{config.contactEmail}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted-foreground/60 font-medium tracking-wide transition-colors">
          <p>© {currentYear} {config.siteName}. All rights reserved.</p>
          <p className="text-center md:text-right">
            {config.legal.entityName} ·{" "}
            <Link href="/legal/imprint" className="hover:text-primary transition-colors">
              Impressum
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
