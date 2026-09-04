"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Lock,
  Unlock,
  QrCode as QrIcon,
  Calendar,
  Users,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";

import { DigitalRibbon } from "./digital-ribbon";
import { ConfettiCanvas } from "./confetti-canvas";
import { launchAudio } from "@/lib/launch-audio";
import type { SiteConfig } from "@/lib/config-schema";

interface LaunchCeremonyProps {
  config: SiteConfig;
}

export function LaunchCeremony({ config }: LaunchCeremonyProps) {
  const [ceremonyState, setCeremonyState] = useState<"READY" | "CUTTING" | "REVEALED">("READY");
  const [isConfettiActive, setIsConfettiActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [siteUrl, setSiteUrl] = useState<string>("https://keralasamajam.de");

  // Generate QR Code on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin;
      setSiteUrl(currentOrigin);
      QRCode.toDataURL(currentOrigin, {
        width: 320,
        margin: 2,
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, []);

  // Handle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Handle Ribbon Cut
  const handleCutRibbon = useCallback(() => {
    if (isLocked || ceremonyState !== "READY") return;

    setCeremonyState("CUTTING");
    launchAudio.playTick();

    // After scissor snip, trigger fanfare and confetti
    setTimeout(() => {
      launchAudio.playLaunchFanfare();
      setIsConfettiActive(true);
      setCeremonyState("REVEALED");
    }, 450);
  }, [isLocked, ceremonyState]);

  // Reset for Rehearsal
  const handleReset = useCallback(() => {
    setCeremonyState("READY");
    setIsConfettiActive(false);
  }, []);

  // Keyboard Shortcuts (Space to Cut, R to Reset, F for Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleCutRibbon();
      } else if (e.key.toLowerCase() === "r") {
        handleReset();
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCutRibbon, handleReset, toggleFullscreen]);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    launchAudio.setMuted(nextMuted);
  };

  const testAudio = () => {
    launchAudio.playTestTone();
  };

  return (
    <div className="relative min-h-screen w-full bg-[#070b12] text-white flex flex-col justify-between overflow-x-hidden selection:bg-amber-500 selection:text-black">
      {/* Confetti Explosion Layer */}
      <ConfettiCanvas active={isConfettiActive} originX={0.5} originY={0.45} />

      {/* Atmospheric Background Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Stage Spotlights */}
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-[120px]" />
        <div className="absolute -top-32 right-1/4 w-96 h-96 bg-rose-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-96 bg-emerald-600/10 rounded-full blur-[160px]" />

        {/* Subtle Kasavu Gold Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* STAGE HEADER */}
      <header className="relative z-20 w-full px-8 py-6 flex items-center justify-between border-b border-white/5 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Image
            src={config.branding.logoUrl || "/images/logo.png"}
            alt={config.siteName}
            width={54}
            height={54}
            className="h-12 w-auto drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            priority
          />
          <div>
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>{config.siteName}</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Official Launch
              </span>
            </h1>
            <p className="text-xs text-stone-400">
              Augsburg, Germany • Community Inauguration Ceremony
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              ceremonyState === "REVEALED" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="text-stone-300 font-medium">
            {ceremonyState === "READY"
              ? "Awaiting Ribbon Cut"
              : ceremonyState === "CUTTING"
              ? "Inaugurating..."
              : "Website Officially Live"}
          </span>
        </div>
      </header>

      {/* MAIN STAGE CONTENT */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 md:px-12 py-8 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {ceremonyState !== "REVEALED" ? (
            /* PRE-LAUNCH CEREMONY STAGE */
            <motion.div
              key="pre-launch"
              className="w-full flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.4 } }}
            >
              {/* Grand Title */}
              <div className="mb-6">
                <p className="text-xs md:text-sm uppercase tracking-[0.3em] font-bold text-amber-400 mb-3 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Grand Inauguration
                  <Sparkles className="w-4 h-4" />
                </p>
                <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 drop-shadow-sm">
                  Welcome to our Digital Home
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg text-stone-300 font-light">
                  Connecting our Malayalam heritage, culture, and community in Augsburg.
                </p>
              </div>

              {/* The Ceremonial Digital Ribbon */}
              <div className="w-full my-6 md:my-10">
                <DigitalRibbon
                  isCut={ceremonyState === "CUTTING"}
                  onCut={handleCutRibbon}
                  disabled={isLocked}
                />
              </div>

              {/* Chief Guest / Dignitary Instructions */}
              <p className="text-xs md:text-sm text-stone-400 max-w-md mx-auto">
                Honorable Chief Guests & Patrons are invited to cut the ribbon to officially unveil the portal.
              </p>
            </motion.div>
          ) : (
            /* POST-LAUNCH REVEAL STAGE */
            <motion.div
              key="revealed"
              className="w-full flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Celebration Banner */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold mb-4"
              >
                <CheckCircle2 className="w-4 h-4" />
                Officially Inaugurated & Live!
              </motion.div>

              <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400">
                  {config.siteName}
                </span>{" "}
                is Now Live!
              </h2>

              <p className="text-base md:text-lg text-stone-300 max-w-xl mx-auto mb-8">
                Welcome to the digital home of Kerala Samajam Augsburg. Explore upcoming events, register as a member, and connect with our vibrant community.
              </p>

              {/* Central Audience Showcase Card (QR Code & Quick Features) */}
              <div className="w-full max-w-4xl bg-stone-900/80 border border-amber-500/30 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center text-left">
                {/* QR Code Section (Projected for the Whole Hall) */}
                <div className="md:col-span-5 flex flex-col items-center text-center p-5 rounded-2xl bg-black/60 border border-white/10">
                  <div className="p-3 bg-white rounded-xl shadow-2xl">
                    {qrCodeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrCodeUrl}
                        alt="Audience QR Code"
                        className="w-48 h-48 md:w-56 md:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 md:w-56 md:h-56 flex items-center justify-center text-black">
                        <QrIcon className="w-12 h-12 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-xs md:text-sm font-bold text-amber-300 flex items-center gap-1.5">
                    <QrIcon className="w-4 h-4" />
                    Scan with your Phone Camera
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1 font-mono">{siteUrl}</p>
                </div>

                {/* Features & Direct Launch Action */}
                <div className="md:col-span-7 flex flex-col justify-between space-y-6">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2">
                      Now Available on the Portal
                    </h3>
                    <p className="text-xs text-stone-400 mb-5">
                      Audience members can instantly open and browse these features:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Event Registrations</p>
                          <p className="text-stone-400 text-[11px]">Seat booking & live ticket passes</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <Users className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Membership Sign-up</p>
                          <p className="text-stone-400 text-[11px]">Join KSA family & member perks</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <ImageIcon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Cultural Gallery</p>
                          <p className="text-stone-400 text-[11px]">Relive community memories & media</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">News & Leadership</p>
                          <p className="text-stone-400 text-[11px]">Committee announcements</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Primary Stage CTA */}
                  <div className="pt-2 flex flex-wrap items-center gap-4">
                    <Link
                      href="/"
                      target="_blank"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3.5 text-sm font-bold text-stone-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                      <span>Explore Live Homepage</span>
                      <ExternalLink className="w-4 h-4" />
                    </Link>

                    <button
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-stone-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors"
                      title="Reset ceremony to practice again"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-arm Ribbon</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* STAGE OPERATOR CONTROLS (Discreet Toolbar in Footer) */}
      <footer className="relative z-20 w-full px-6 py-4 border-t border-white/5 bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs text-stone-400">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
            Stage Controls:
          </span>
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              isMuted
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-white/5 border-white/10 text-stone-300 hover:text-white"
            }`}
            title="Toggle Sound Effects"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? "Sound Muted" : "Sound On"}</span>
          </button>

          <button
            onClick={testAudio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-stone-300 hover:text-white text-xs transition-colors"
            title="Test Projector / PA Audio"
          >
            <span>Test Sound</span>
          </button>

          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              isLocked
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-white/5 border-white/10 text-stone-300 hover:text-white"
            }`}
            title="Lock screen against accidental clicks before VIP arrives"
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{isLocked ? "Stage Locked" : "Unlocked"}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-[11px] text-stone-500">
            Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300">Space</kbd> to Cut •{" "}
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300">F</kbd> for Fullscreen •{" "}
            <kbd className="px-1 py-0.5 rounded bg-white/10 text-stone-300">R</kbd> to Reset
          </span>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 text-xs font-medium transition-colors"
            title="Toggle Fullscreen for Projector"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? "Exit Fullscreen" : "Projector Fullscreen"}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
