"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ceremonyFeatures, type QrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * What the hall looks at while they get their phones out.
 *
 * The QR is generated at error-correction level H and rendered large. A
 * projector's keystone correction and focus both work against a scan from
 * fifteen metres away, and H tolerates roughly a third of the code being
 * unreadable — which is the difference between a room full of successful scans
 * and a room full of people giving up.
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
      className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-12"
    >
      <div className="flex flex-col items-center gap-4 md:col-span-5">
        {target.ok ? (
          <>
            <div className="rounded-2xl bg-white p-4 shadow-2xl">
              {qrImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrImage}
                  alt={`QR code linking to ${target.url}`}
                  className="h-56 w-56 object-contain md:h-72 md:w-72"
                />
              ) : (
                <div className="h-56 w-56 md:h-72 md:w-72" />
              )}
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/50">
              Scan to open
            </p>
            {/* Printed large on purpose: it lets the operator confirm the
                destination at a glance, and anyone whose camera will not scan
                can simply type it. */}
            <p className="font-sans text-xl font-extrabold tracking-[-0.02em] text-white">
              {target.url.replace(/^https:\/\//, "")}
            </p>
          </>
        ) : (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left">
            <p className="font-sans text-base font-extrabold text-white">
              No QR code — the site address is not configured
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              {target.reason}
            </p>
          </div>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-7">
        {features.map((feature) => (
          <li
            key={feature.key}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left"
          >
            <p className="font-sans text-base font-extrabold tracking-[-0.02em] text-white">
              {feature.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/55">
              {feature.blurb}
            </p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
