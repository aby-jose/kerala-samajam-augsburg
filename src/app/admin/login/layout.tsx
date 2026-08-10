"use client";

import Image from "next/image";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-zinc-950">
      {/* Kerala nature background */}
      <div className="absolute inset-0 z-0 select-none">
        <Image
          src="/images/nature-bg.png"
          alt=""
          fill
          className="object-cover opacity-60"
          priority
        />
        {/* Darkening overlay for card legibility */}
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/30 to-black/70" />
      </div>

      {/* Centered content */}
      <main className="relative z-10 flex w-full items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
