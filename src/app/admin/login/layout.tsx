"use client";

import Image from "next/image";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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

      {/* Top controls */}
      <div className="absolute right-6 top-6 z-50 flex items-center">
        <ThemeToggle className="text-white hover:bg-white/10" />
      </div>

      {/* Centered content */}
      <main className="relative z-10 flex w-full items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
