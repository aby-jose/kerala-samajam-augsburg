"use client";

import React from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getRegistrationByTicketId, toggleCheckIn } from "@/lib/event-actions";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { cardSurface, panelHeader, chipTone, toolbarChip } from "@/components/admin/ui/surface";

interface ScanResult {
  success: boolean;
  name: string;
  attendees: number;
  ticketId: string;
  event: string;
}

export default function QRScannerPage() {
  const { eventId } = useParams();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<IScannerControls | null>(null);

  const [isScanning, setIsScanning] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startScanning = async () => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);

    const codeReader = new BrowserMultiFormatReader();

    try {
      if (videoRef.current) {
        const controls = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              handleScan(result.getText());
              controls.stop();
              setIsScanning(false);
            }
          }
        );
        controlsRef.current = controls;
      }
    } catch (err) {
      console.error("Scanner error:", err);
      setError("Could not access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setIsScanning(false);
  };

  React.useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  const handleScan = async (ticketId: string) => {
    setIsLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const registration = await getRegistrationByTicketId(ticketId);

      if (!registration) {
        setError("Invalid ticket: no registration found for this ID.");
        return;
      }

      if (registration.isCheckedIn) {
        setError(`${registration.name} is already checked in.`);
        return;
      }

      if (eventId !== "all" && registration.eventId !== eventId) {
        setError(`Ticket is for a different event: ${registration.event?.title}`);
        return;
      }

      // Perform real check-in
      await toggleCheckIn(registration.id, true);

      setScanResult({
        success: true,
        name: registration.name,
        attendees: registration.attendees,
        ticketId: registration.ticketId,
        event: registration.event?.title || "Unknown Event"
      });
    } catch (err) {
      console.error("Verification failed:", err);
      setError("Failed to verify ticket. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR check-in"
        description="Scan attendee tickets to check them in."
      >
        <Link href="/admin/registrations" onClick={stopScanning}>
          <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to registrations
          </Button>
        </Link>
      </PageHeader>

      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Scanner */}
        <section className={cn(cardSurface, "overflow-hidden")}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Scanner</h2>
              <p className="text-xs text-muted-foreground">Point the camera at a ticket QR code.</p>
            </div>
          </header>
          <div className="p-5">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
              {!isScanning && !scanResult && !isLoading && !error && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/80">
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-full", chipTone("primary"))}>
                    <Camera className="h-6 w-6" />
                  </div>
                  <Button onClick={startScanning} className="h-9 rounded-lg">
                    Start scanning
                  </Button>
                </div>
              )}

              <video
                ref={videoRef}
                className={cn(
                  "h-full w-full object-cover",
                  !isScanning && "opacity-30"
                )}
              />

              {isScanning && (
                <div className="pointer-events-none absolute inset-x-8 top-1/2 z-20 -translate-y-1/2">
                  <div className="h-0.5 w-full animate-pulse rounded-full bg-primary" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Status / results */}
        {isLoading && (
          <div className={cn(cardSurface, "flex items-center justify-center gap-3 p-6")}>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Verifying ticket…</span>
          </div>
        )}

        {scanResult && (
          <section className={cn(cardSurface, "animate-in fade-in duration-300")}>
            <div className={panelHeader}>
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", chipTone("emerald"))}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-sm font-semibold text-foreground">Ticket valid</h3>
                  <p className="truncate text-xs text-muted-foreground">{scanResult.event}</p>
                </div>
              </div>
              <StatusBadge tone="success">Checked in</StatusBadge>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Attendee</span>
                <span className="text-sm font-medium text-foreground">{scanResult.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">Party size</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {scanResult.attendees} {scanResult.attendees === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Ticket ID</span>
                <span className="font-mono text-xs font-medium text-foreground">{scanResult.ticketId}</span>
              </div>
              <Button className="h-9 w-full rounded-lg" onClick={startScanning}>
                Scan next
              </Button>
            </div>
          </section>
        )}

        {error && (
          <section className={cn(cardSurface, "p-6 animate-in fade-in duration-300")}>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                <XCircle className="h-6 w-6" />
              </div>
              <h3 className="font-sans text-sm font-semibold text-foreground">Check-in failed</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="mt-4 h-9 w-full rounded-lg"
                onClick={startScanning}
              >
                Try again
              </Button>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Having trouble scanning?{" "}
          <Link href="/admin/registrations" className="font-medium text-primary hover:underline">
            Use the registrations list
          </Link>
        </p>
      </div>
    </div>
  );
}
