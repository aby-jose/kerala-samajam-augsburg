"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { ADDRESS_MOVE_MS } from "@/lib/ceremony-timing";

const EASE = [0.16, 1, 0.3, 1] as const;
const GOLD = "#C9A227";

/**
 * The caption under the screen: the code, a gold rule, the address.
 *
 * Not a bar. It was a plate the screen's width for a while, with the mark at
 * the far end, and it read as a toolbar under a window. This is a caption
 * the way a photograph has one: a compact group, centred, standing on the
 * floor with nothing drawn behind it — the white of the code, a hairline of
 * the curtain's gold, and the address with its cue above it. The eye drops
 * from the picture to the line beneath and finds both a code to point a
 * phone at and an address to type.
 *
 * It comes up around the address as the address arrives from the glass
 * (see `Address`: the address is this caption's child, travelling in), a
 * beat after it has landed, so the arrival is read before the rest appears.
 * It leaves with the frame when the site grows to full screen.
 *
 * The code is generated at error-correction level H: a projector's keystone
 * and focus both work against a scan from fifteen metres, and H tolerates
 * roughly a third of the code being unreadable. Rendered at 1024 so it
 * stays crisp at any size.
 */
export function Nameplate({
  url,
  visible,
  leaving,
  children,
}: {
  url: string;
  /** True once the address has arrived and the caption should show. */
  visible: boolean;
  /** True while the page grows to full screen: the caption goes with the frame. */
  leaving: boolean;
  /** The address, when it is here. */
  children?: React.ReactNode;
}) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      width: 1024,
      margin: 1,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    })
      .then(setImage)
      .catch(() => setImage(null));
  }, [url]);

  const shown = visible && !leaving;
  // The rest of the caption waits for the address to land. Opacity only,
  // never a move: the address travels in by layout animation, and a caption
  // that was itself moving would give it a moving target.
  const reveal = {
    initial: false as const,
    animate: { opacity: shown ? 1 : 0 },
    transition: {
      duration: leaving ? 0.4 : 0.8,
      delay: shown ? (ADDRESS_MOVE_MS / 1000) * 0.75 : 0,
      ease: EASE,
    },
  };

  return (
    // The whole caption, address included, goes with the frame when the site
    // grows: the per-part reveal below is for the entrance only.
    <motion.div
      className="flex items-center justify-center gap-[2.6vmin]"
      style={{ height: "9vh" }}
      initial={false}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* The code. */}
      <motion.div
        className="shrink-0 rounded-[0.6vmin] p-[0.7vmin]"
        style={{
          backgroundColor: "#FFFFFF",
          height: "8.2vh",
          width: "8.2vh",
          boxShadow: "0 1.6vmin 4vmin -1.4vmin rgba(0,0,0,0.9)",
        }}
        {...reveal}
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`QR code linking to ${url}`} className="block h-full w-full" />
        )}
      </motion.div>

      {/* The curtain's own gold, as a hairline between the code and the address. */}
      <motion.span
        aria-hidden
        className="block w-[0.16vmin] min-w-px shrink-0"
        style={{
          height: "6.4vh",
          background: `linear-gradient(180deg, transparent, ${GOLD} 22%, ${GOLD} 78%, transparent)`,
        }}
        {...reveal}
      />

      {/* The cue, and the address beneath it. */}
      <div className="flex flex-col items-start gap-[1vmin]">
        <motion.span
          className="font-sans text-[1.2vmin] font-semibold uppercase tracking-[0.22em]"
          style={{ color: "rgba(227,213,192,0.62)" }}
          {...reveal}
        >
          Scan the code, or visit
        </motion.span>
        <span className="flex h-[2.8vmin] items-center">{children}</span>
      </div>
    </motion.div>
  );
}
