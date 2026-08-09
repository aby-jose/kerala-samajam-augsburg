"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ 
  children, 
  basePath 
}: { 
  children: React.ReactNode;
  basePath?: string;
}) {
  return (
    <SessionProvider basePath={basePath}>
      {children}
    </SessionProvider>
  );
}
