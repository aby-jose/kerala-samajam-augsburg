"use client";

import React from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { 
  ArrowLeft, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

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
      // Simulate API verification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock verification logic
      if (ticketId.includes("KSA-")) {
        setScanResult({
          success: true,
          name: "Aby Joseph",
          attendees: 4,
          ticketId: ticketId,
          event: "Vishu Celebration 2026"
        });
      } else {
        setError("Invalid Ticket ID or QR Code structure.");
      }
    } catch (err) {
      setError("Failed to verify ticket. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <header className="p-6 flex items-center justify-between border-b border-white/10 shrink-0">
        <Link 
          href="/admin/registrations" 
          onClick={stopScanning}
          className="flex items-center text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Exit Scanner
        </Link>
        <h2 className="text-lg font-bold">QR Check-in</h2>
        <div className="w-20" /> {/* Spacer */}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Scanner Area */}
        <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900">
          <AnimatePresence>
            {!isScanning && !scanResult && !isLoading && !error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
              >
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 ring-4 ring-primary/10">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <Button size="lg" onClick={startScanning} className="px-8 h-12 font-bold shadow-xl">
                  Start Scanning
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <video 
            ref={videoRef} 
            className={cn(
              "w-full h-full object-cover",
              !isScanning && "opacity-30"
            )} 
          />
          
          {/* Scanning Overlay Animation */}
          {isScanning && (
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="h-1 w-full bg-primary shadow-[0_0_20px_rgba(var(--primary),1)] animate-pulse" />
              <div className="absolute inset-0 border-2 border-primary/20 rounded-lg scale-110" />
            </div>
          )}
        </div>

        {/* Status / Results Card */}
        <div className="w-full max-w-md mt-12 min-h-[120px]">
          {isLoading && (
            <Card className="bg-white/5 border-white/10 text-white animate-pulse border-none">
              <CardContent className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-4" />
                <span className="text-xl font-medium">Verifying Ticket...</span>
              </CardContent>
            </Card>
          )}

          <AnimatePresence mode="wait">
            {scanResult && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
              >
                <Card className="bg-green-500/10 border-green-500/40 text-white border-none shadow-2xl overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <CheckCircle2 className="h-12 w-12 text-green-500/20" />
                  </div>
                  <CardContent className="p-8">
                    <div className="flex items-center mb-8">
                      <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center mr-4">
                        <CheckCircle2 className="h-7 w-7 text-black" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">Valid Ticket</h3>
                        <p className="text-green-500 text-sm font-semibold uppercase tracking-wider">Check-in Success</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-6 border-t border-white/10">
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-sm">Attendee</span>
                        <span className="font-bold text-lg">{scanResult.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-sm">Booking Group</span>
                        <span className="font-bold flex items-center text-lg">
                          <Users className="h-4 w-4 mr-2 text-primary" />
                          {scanResult.attendees} People
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                        <span className="text-white/40 text-xs">ID</span>
                        <span className="font-mono text-primary text-sm font-bold">{scanResult.ticketId}</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full mt-8 h-14 text-lg font-black shadow-lg shadow-green-900/20"
                      onClick={startScanning}
                    >
                      Scan Next
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {error && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
              >
                <Card className="bg-red-500/10 border-red-500/40 text-white border-none shadow-2xl">
                  <CardContent className="p-8 flex flex-col items-center text-center">
                    <div className="h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                      <XCircle className="h-12 w-12 text-red-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Check-in Failed</h3>
                    <p className="text-red-500/80 mb-8 max-w-xs">{error}</p>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-white/20 text-white hover:bg-white/10 font-bold"
                      onClick={startScanning}
                    >
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Manual Search Helper */}
      <footer className="p-8 border-t border-white/10 text-center shrink-0">
        <p className="text-white/40 text-xs mb-4 uppercase tracking-widest">Having trouble scanning?</p>
        <Link href="/admin/registrations" className="text-primary hover:underline font-bold text-sm">
          Return to Manual List
        </Link>
      </footer>

      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          100% { transform: scale(1.05); opacity: 0.1; }
        }
      `}</style>
    </div>
  );
}
