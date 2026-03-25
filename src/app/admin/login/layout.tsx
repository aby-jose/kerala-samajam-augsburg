"use client";

import { Navbar } from "@/components/layout/navbar";
import Image from "next/image";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-full relative flex flex-col items-center justify-center bg-zinc-950 overflow-hidden">
      {/* Cinematic Nature Background */}
      <div className="absolute inset-0 z-0 select-none">
        <Image
          src="/images/nature-bg.png"
          alt="Kerala Nature Background"
          fill
          className="object-cover opacity-60"
          priority
        />
        {/* Stronger overlay for high-impact glassmorphism */}
        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/20 to-black/80" />
      </div>

      {/* Theme Adaptive Navbar (Forced Light Text) */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <Navbar hideLinks forceLightText />
      </div>

      {/* Centered Content Area */}
      <main className="relative z-10 w-full flex items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
