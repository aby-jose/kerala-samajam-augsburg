"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SiteConfig, defaultConfig } from "@/lib/config-schema";

const ConfigContext = createContext<SiteConfig>(defaultConfig);

export const useConfig = () => useContext(ConfigContext);

export function ConfigProvider({ 
  children, 
  initialConfig 
}: { 
  children: React.ReactNode;
  initialConfig: SiteConfig;
}) {
  useEffect(() => {
    const primaryHex = initialConfig.branding.primaryColor;
    const hsl = hexToHsl(primaryHex);
    if (hsl) {
      document.documentElement.style.setProperty("--primary", hsl);
      document.documentElement.style.setProperty("--ring", hsl);
    }
  }, [initialConfig.branding.primaryColor]);

  return (
    <ConfigContext.Provider value={initialConfig}>
      {children}
    </ConfigContext.Provider>
  );
}

function hexToHsl(hex: string): string | null {
  // Remove hash if present
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex.split("").map(s => s + s).join("");
  }

  if (hex.length !== 6) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}
