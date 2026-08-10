"use client";

import React, { createContext, useContext } from "react";
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
  // The brand colour CSS variables are set server-side on <html> in
  // src/app/layout.tsx — doing it here in an effect caused a colour flash.
  return (
    <ConfigContext.Provider value={initialConfig}>
      {children}
    </ConfigContext.Provider>
  );
}
