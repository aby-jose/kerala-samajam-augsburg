"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ceremonyFeatures, type QrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

const CREAM = "#F5EFE6";

/**
 * What the hall looks at while they get their phones out.
 *
 * Two things leave this room in someone's head: the address, and a scan. So
 * the address is the headline — set at the size a poster would use, spanning
 * the composition — and the QR is the largest object under it. Everything else
 * on this screen is deliberately quiet: the four site areas are a list of
 * hairline-separated lines, not four bordered cards competing with the code
 * they sit beside, and there is no "Scan to open" label because a QR under a
 * printed URL does not need to be told apart from anything.
 *
 * The QR is generated at error-correction level H. A projector's keystone
 * correction and focus both work against a scan from fifteen metres away, and
 * H tolerates roughly a third of the code being unreadable — which is the
 * difference between a room full of successful scans and a room full of people
 * giving up.
 *
 * Everything is sized in vmin/clamp rather than pixels: this has to hold on a
 * 1920x1080 projector and on a 1024x768 one without clipping either.
 *
 * The target arrives as a prop, resolved on the server: the variable behind it
 * is not exposed to the client bundle, so resolving it here would always fail.
 */
export function ShowcasePanel({
  config,
  qr,
}: {
  config: SiteConfig;
  qr: QrTarget;
}) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const target = qr;
  const features = ceremonyFeatures(config);
  const url = target.ok ? target.url : null;

  useEffect(() => {
    if (!url) return;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 1024,
      margin: 3,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [url]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.15 }}
      className="flex w-full max-w-6xl flex-col items-center gap-[4vmin] text-left"
    >
      {target.ok ? (
        /* The single thing a person carries out of the hall. Printed at
           poster scale so it is readable from the back row, and legible
           enough to type for anyone whose camera will not scan. */
        <p
          className="w-full text-center font-sans font-extrabold leading-[1.02] tracking-[-0.035em] break-words"
          style={{ color: CREAM, fontSize: "clamp(2.5rem, 6vw, 5.5rem)" }}
        >
          {target.url.replace(/^https:\/\//, "")}
        </p>
      ) : (
        <div className="w-full rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left">
          <p className="font-sans text-base font-extrabold text-white">
            No QR code — the site address is not configured
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {target.reason}
          </p>
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-[4vmin] md:flex-row md:items-center md:gap-[5vmin]">
        {target.ok && (
          <div
            className="shrink-0 rounded-md p-[1.6vmin] shadow-2xl"
            style={{ backgroundColor: CREAM }}
          >
            {qrImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrImage}
                alt={`QR code linking to ${target.url}`}
                className="block object-contain"
                style={{
                  width: "clamp(11rem, 23vmin, 19rem)",
                  height: "clamp(11rem, 23vmin, 19rem)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "clamp(11rem, 23vmin, 19rem)",
                  height: "clamp(11rem, 23vmin, 19rem)",
                }}
              />
            )}
          </div>
        )}

        <div className="flex w-full min-w-0 flex-col gap-[2.5vmin]">
          {/* A list, not cards. No borders, no fills, no icons — the hairlines
              do all the separating that four short lines need. */}
          <ul className="w-full divide-y divide-white/10">
            {features.map((feature) => (
              <li
                key={feature.key}
                className="flex flex-col gap-x-3 gap-y-0.5 py-[1.4vmin] sm:flex-row sm:items-baseline"
              >
                <p
                  className="font-sans text-[clamp(1rem,1.7vmin,1.5rem)] font-semibold tracking-[-0.015em]"
                  style={{ color: CREAM }}
                >
                  {feature.title}
                </p>
                <p className="text-[clamp(0.875rem,1.4vmin,1.25rem)] leading-relaxed text-white/55">
                  {feature.blurb}
                </p>
              </li>
            ))}
          </ul>

          {/* Same tab, on purpose: this is the operator's way back to the site
              on the machine driving the projector, not a share link. Restrained
              enough that it never competes with the code beside it. */}
          <Link
            href="/"
            className="inline-flex w-fit items-center rounded-md border px-[2.2vmin] py-[1.2vmin] font-sans text-[clamp(0.875rem,1.5vmin,1.25rem)] font-semibold tracking-[-0.01em] transition-colors hover:bg-[#F5EFE6]/10"
            style={{ borderColor: "rgba(245,239,230,0.45)", color: CREAM }}
          >
            Open the website
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
