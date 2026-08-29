"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useConfig } from "@/components/providers/config-provider";
import {
  COOKIE_BANNER_VISIBILITY_EVENT,
  getStoredCookieConsent,
} from "@/components/legal/cookie-consent";

const LABEL = "Join our WhatsApp group";

/** The brand glyph. lucide has no WhatsApp icon — the footer substitutes
 *  `MessageCircle`, which reads as "chat" rather than as this one app, and a
 *  lone floating circle has no surrounding copy to make up the difference. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/**
 * Floating link to the community WhatsApp group, on every public page.
 *
 * Driven entirely by the existing `socials.whatsapp` setting: blank it in the
 * admin and the button disappears, exactly as `WhatsAppCta` behaves. There is
 * deliberately no separate on/off switch — two controls for one button is the
 * kind of thing that ends up contradicting itself.
 */
export function WhatsAppFab() {
  const config = useConfig();
  const reduced = useReducedMotion();
  const groupLink = config.socials?.whatsapp;

  // The cookie banner is pinned to this same corner and is up to 30rem wide,
  // so the two would sit on top of each other — and it shows on exactly the
  // visit where a stranger is most likely to want the group. Yield to it.
  const [bannerOpen, setBannerOpen] = React.useState(true);

  React.useEffect(() => {
    // The banner decides its own visibility in an effect, so it may not have
    // announced anything yet when this mounts. Read the same cookie it reads
    // to get the first frame right, then let its events keep us in sync.
    setBannerOpen(getStoredCookieConsent() === null);

    const onVisibility = (event: Event) => {
      setBannerOpen(Boolean((event as CustomEvent<{ open: boolean }>).detail?.open));
    };

    window.addEventListener(COOKIE_BANNER_VISIBILITY_EVENT, onVisibility);
    return () =>
      window.removeEventListener(COOKIE_BANNER_VISIBILITY_EVENT, onVisibility);
  }, []);

  if (!groupLink) return null;

  return (
    <AnimatePresence>
      {!bannerOpen && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: reduced ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed bottom-0 right-0 z-50 p-5 md:p-6"
        >
          <a
            href={groupLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABEL}
            className="group pointer-events-auto flex h-14 items-center rounded-full bg-primary px-4 text-primary-foreground shadow-xl shadow-primary/30 outline-none transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <WhatsAppGlyph className="h-6 w-6 shrink-0" />
            {/* Grows out of the circle on hover, on pointer devices only — on a
                phone the circle stays a circle rather than permanently eating
                a strip of the screen. */}
            <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-bold tracking-[-0.01em] opacity-0 transition-[max-width,opacity,margin] duration-500 ease-out group-hover:ml-2.5 group-hover:max-w-[14rem] group-hover:opacity-100 group-focus-visible:ml-2.5 group-focus-visible:max-w-[14rem] group-focus-visible:opacity-100 motion-reduce:transition-none md:block">
              {LABEL}
            </span>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
