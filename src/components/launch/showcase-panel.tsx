"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ceremonyFeatures, displayUrl, type QrTarget } from "@/lib/ceremony-showcase";
import type { SiteConfig } from "@/lib/config-schema";

const EASE = [0.16, 1, 0.3, 1] as const;

const CREAM = "#F5EFE6";

/**
 * What the hall looks at while they get their phones out.
 *
 * One plate, three bands, in the order a person needs them: the address they
 * just watched being typed, the code that saves them typing it, and what they
 * will find. Everything sits inside a single hairline border on a shared grid
 * — nothing floats loose on the stage, and the two columns share a baseline —
 * because at projector scale a composition that drifts reads as an accident.
 *
 * The QR is generated at error-correction level H. A projector's keystone
 * correction and focus both work against a scan from fifteen metres, and H
 * tolerates roughly a third of the code being unreadable, which is the
 * difference between a room of successful scans and a room of people giving
 * up.
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
  const features = ceremonyFeatures(config);
  const url = qr.ok ? qr.url : null;

  useEffect(() => {
    if (!url) return;

    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 1024,
      margin: 2,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [url]);

  if (!qr.ok) {
    return (
      <div className="w-full max-w-[70vmin] rounded-[1.2vmin] border border-primary/45 bg-primary/10 p-[3vmin] text-left">
        <p className="font-sans text-[2.4vmin] font-extrabold text-white">
          No QR code — the site address is not configured
        </p>
        <p className="mt-[1vmin] text-[1.8vmin] leading-relaxed text-white/70">{qr.reason}</p>
      </div>
    );
  }

  // Sized against the room, not the layout: this is scanned from up to
  // fifteen metres, and the plate had vertical headroom going spare.
  const codeSize = "clamp(8rem, 28vmin, 19rem)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="w-full overflow-hidden rounded-[1.6vmin] border backdrop-blur-[2px]"
      style={{
        maxWidth: "100%",
        borderColor: "rgba(245,239,230,0.22)",
        backgroundColor: "rgba(0,0,0,0.34)",
      }}
    >
      {/* Band 1 — the address, exactly as it was typed. */}
      <div
        className="border-b px-[2.4vmin] py-[1.35vmin] text-center"
        style={{ borderColor: "rgba(245,239,230,0.16)" }}
      >
        <p
          className="font-sans font-extrabold leading-none tracking-[-0.035em] break-all"
          style={{ color: CREAM, fontSize: "clamp(1.3rem, 4.2vmin, 3.4rem)" }}
        >
          {displayUrl(qr.url)}
        </p>
      </div>

      {/* Band 2 — the code, and what is behind it. Two columns, one baseline. */}
      <div className="flex flex-col items-stretch gap-[2.6vmin] px-[2.6vmin] py-[1.75vmin] md:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-[1vmin]">
          <div className="rounded-[0.8vmin] p-[1vmin]" style={{ backgroundColor: CREAM }}>
            {qrImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={qrImage}
                alt={`QR code linking to ${qr.url}`}
                className="block object-contain"
                style={{ width: codeSize, height: codeSize }}
              />
            ) : (
              <div style={{ width: codeSize, height: codeSize }} />
            )}
          </div>
          <p className="font-sans text-[1.55vmin] font-semibold tracking-[-0.01em] text-white/55">
            Point your camera here
          </p>
        </div>

        {/* A list, not cards: four short lines need hairlines, not four boxes
            competing with the code beside them. */}
        <ul
          className="flex min-w-0 flex-1 flex-col justify-center divide-y"
          style={{ borderColor: "rgba(245,239,230,0.14)" }}
        >
          {features.map((feature) => (
            <li
              key={feature.key}
              className="flex flex-col gap-x-[1.6vmin] gap-y-[0.3vmin] py-[1.35vmin] first:pt-0 last:pb-0 sm:flex-row sm:items-baseline"
              style={{ borderColor: "rgba(245,239,230,0.14)" }}
            >
              <p
                className="w-[26vmin] shrink-0 font-sans text-[2vmin] font-bold tracking-[-0.015em]"
                style={{ color: CREAM }}
              >
                {feature.title}
              </p>
              <p className="text-[1.8vmin] leading-snug text-white/55">{feature.blurb}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Band 3 — the way in, for the machine driving the projector. */}
      <div
        className="border-t px-[2.4vmin] py-[1.15vmin] text-center"
        style={{ borderColor: "rgba(245,239,230,0.16)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center rounded-full border px-[3vmin] py-[1.2vmin] font-sans text-[1.85vmin] font-bold tracking-[-0.01em] transition-colors hover:bg-[#F5EFE6]/12"
          style={{ borderColor: "rgba(245,239,230,0.5)", color: CREAM }}
        >
          Open the website
        </Link>
      </div>
    </motion.div>
  );
}
