"use client";

import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import { 
  X, 
  Upload, 
  Search, 
  Loader2, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  Maximize2,
  Camera,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { searchMediaByFace } from "@/lib/gallery-actions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { BiometricConsentGate } from "@/components/legal/biometric-consent-gate";
import { Accent } from "@/components/layout/section-heading";

const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/";

/**
 * The one utility-label voice, lifted from the hero eyebrow.
 *
 * This file had grown seven different treatments for the same job — 8px to
 * 12px, medium through black, three tracking values — so the modal read as a
 * different product to the rest of the site. `TIGHT` is the same voice with
 * the tracking pulled in, for labels inside chips and badges where 0.22em
 * does not fit.
 */
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.22em]";
const LABEL_TIGHT = "text-[10px] font-semibold uppercase tracking-[0.12em]";

interface FaceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId?: string;
}

export default function FaceSearchModal({ isOpen, onClose, albumId }: FaceSearchModalProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { loading, dismiss, success, error } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setResults([]);
      setIsSearching(false);
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      error("Camera access is not supported by your browser or connection (needs HTTPS).");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      setStream(mediaStream);
      setIsCameraActive(true);
      setPreview(null);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      if (err.name === "NotAllowedError") {
        error("Camera permission denied. Please click the camera icon in your browser's address bar to allow access.");
      } else {
        error("Could not access camera. Please check your device settings.");
      }
    }
  };

  useEffect(() => {
    if (isCameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, stream]);

  useEffect(() => {
    if (isOpen && !modelsLoaded) {
      const loadModels = async () => {
        try {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ]);
          setModelsLoaded(true);
        } catch (err) {
          console.error("Failed to load models:", err);
          error("Failed to initialize AI models.");
        }
      };
      loadModels();
    }
  }, [isOpen, modelsLoaded, error]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Handle mirroring
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0);
        ctx.restore();

        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            handleFileProcess(file);
            stopCamera();
          }
        }, "image/jpeg", 0.95);
      }
    }
  };

  const handleFileProcess = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setResults([]);
    setIsSearching(true);
    const toastId = loading("Analyzing face...");

    try {
      const img = await faceapi.bufferToImage(file);
      // Use TinyFaceDetector for consistency with ingestion
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        error("No face detected. Please try another photo.");
        setIsSearching(false);
        dismiss(toastId);
        return;
      }

      dismiss(toastId);
      const searchToastId = loading("Searching the archive...");
      
      const matches = await searchMediaByFace(Array.from(detection.descriptor), albumId);
      setResults(matches);
      
      if (matches.length > 0) {
        success(`Found ${matches.length} matching photos!`);
      } else {
        error("No matches found in this collection.");
      }
      dismiss(searchToastId);
    } catch (err) {
      console.error("Search failed:", err);
      error("Something went wrong during the search.");
      dismiss(toastId);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
  };

  const handleDownload = (publicId: string, type: string) => {
    window.location.href = `/api/gallery/download?publicId=${encodeURIComponent(publicId)}&type=${encodeURIComponent(type)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-card border border-border/40 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 border-b border-border/40 flex items-center justify-between bg-secondary/10">
          {/* Same voice as the hero: Manrope extrabold at -0.035em with one
              Newsreader italic word in primary. Without `font-sans` the base
              layer's h1-h6 rule sets this in Newsreader, which is why the
              title read as a heavy serif. */}
          <div className="space-y-1.5">
            <h2 className="font-sans text-xl md:text-2xl font-extrabold tracking-[-0.035em] text-foreground">
              {isCameraActive ? (
                <>Take a <Accent>Selfie</Accent></>
              ) : (
                <>Find My <Accent>Photos</Accent></>
              )}
            </h2>
            <p className={cn(LABEL, "text-muted-foreground")}>
              {isCameraActive ? "Align your face in the centre" : "AI-powered face search"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {/* Nothing below runs until explicit Art. 9 consent is on record. */}
          <BiometricConsentGate>
          {isCameraActive ? (
            <div className="space-y-6">
              <div className="relative aspect-video w-full rounded-3xl overflow-hidden border-4 border-primary/20 shadow-2xl bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none flex items-center justify-center">
                  <div className="w-[30%] aspect-[3/4] border-2 border-dashed border-white/40 rounded-full" />
                </div>
                <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
                  <Button 
                    variant="secondary" 
                    onClick={stopCamera} 
                    className="rounded-full h-12 w-12 bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-black/60"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  <Button 
                    onClick={capturePhoto} 
                    className="rounded-full h-20 w-20 bg-white hover:bg-neutral-200 border-8 border-primary/10 p-0 flex items-center justify-center shadow-2xl transition-transform active:scale-90"
                  >
                    <div className="h-12 w-12 rounded-full bg-primary" />
                  </Button>
                  <div className="w-12 h-12" />
                </div>
              </div>
              <p className={cn(LABEL, "text-center text-muted-foreground")}>
                Your photo is processed locally and never stored
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div 
                  className={cn(
                    "aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all relative overflow-hidden group bg-muted/5",
                    preview ? "border-primary/20" : "border-border/60 hover:border-primary/40"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  
                  {preview ? (
                    <>
                      <img src={preview} alt="Reference" className="w-full h-full object-cover" />
                      {/* Same two actions as the empty state, so the same pair
                          and the same order — over the image the outline half
                          is tinted glass, since a border-only button on a photo
                          disappears against whatever is behind it. */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/50 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          onClick={startCamera}
                          className="h-10 w-full max-w-[10rem] rounded-xl text-[10px] font-bold uppercase tracking-[0.16em]"
                        >
                          <Camera className="mr-2 h-3.5 w-3.5" />
                          Retake selfie
                        </Button>
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          className="h-10 w-full max-w-[10rem] rounded-xl border border-white/25 bg-white/10 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm hover:bg-white/20"
                        >
                          <Upload className="mr-2 h-3.5 w-3.5" />
                          Upload another
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full space-y-5 p-6 text-center">
                      <div className="space-y-1.5">
                        <p className="text-[13px] font-bold tracking-[-0.01em] text-foreground">Reference photo</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">Matched against every event album.</p>
                      </div>
                      {/* The site's button language rather than a bespoke one:
                          the filled/outline pair from the gallery header, at
                          the consent gate's h-11 rounded-xl spec. The two 64px
                          icon tiles this replaces appeared on no other screen,
                          and a 10px tracked label never fitted inside one. */}
                      <div className="flex flex-col gap-2.5">
                        <Button
                          onClick={startCamera}
                          className="h-11 w-full rounded-xl text-[10px] font-bold uppercase tracking-[0.18em] shadow-lg shadow-primary/20"
                        >
                          <Camera className="mr-2 h-3.5 w-3.5" />
                          Take a selfie
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-11 w-full rounded-xl border-border text-[10px] font-bold uppercase tracking-[0.18em] transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          <Upload className="mr-2 h-3.5 w-3.5" />
                          Upload a photo
                        </Button>
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <Zap className="w-8 h-8 animate-pulse text-primary" />
                      <span className={cn(LABEL, "text-primary")}>Searching</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted/20 rounded-2xl border border-border/40">
                  <h4 className={cn(LABEL, "font-sans text-muted-foreground mb-2 flex items-center gap-2")}>
                    <CheckCircle2 className="w-3 h-3 text-primary" /> Privacy note
                  </h4>
                  {/*
                    The old wording said nothing was stored at all, which read
                    as if no biometrics existed — while face descriptors for
                    gallery photos are held server-side. Both halves are stated
                    now so the note is actually accurate.
                  */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Your reference photo is processed in your browser and is never
                    uploaded. Face descriptors for gallery photos are stored on our
                    servers and deleted with the photo — see the{" "}
                    <Link href="/legal/privacy" className="font-semibold text-primary underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <h3 className="font-sans text-sm font-extrabold tracking-[-0.02em] text-foreground">
                    Discovered moments
                  </h3>
                  <Badge variant="outline" className={cn(LABEL_TIGHT, "rounded-lg")}>
                    {results.length} matches
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {results.length === 0 ? (
                    // This block covers two different states: nothing searched
                    // yet, and a search that came back empty. One line for both
                    // would be wrong in one of them.
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className={LABEL}>
                        {preview ? "No matches in the archive" : "Add a reference photo to start"}
                      </p>
                      {preview && (
                        <p className="mx-auto mt-3 max-w-[15rem] text-[11px] leading-relaxed">
                          Try a photo where your face is larger and clearly lit.
                        </p>
                      )}
                    </div>
                  ) : (
                    results.map((media) => (
                      <motion.div
                        key={media.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="aspect-square rounded-2xl overflow-hidden border border-border/40 group relative"
                      >
                        <img src={media.url} alt="Match" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                          <div className="flex gap-2">
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              onClick={() => setSelectedPreview(media.url)}
                              className="h-9 w-9 rounded-xl bg-white text-black"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              onClick={() => handleDownload(media.publicId, media.type)}
                              className="h-9 w-9 rounded-xl bg-white text-black"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                          <Link href={`/gallery/${media.albumId}`}>
                            <Button variant="link" className={cn(LABEL_TIGHT, "text-white hover:text-primary transition-colors")}>
                              View album
                            </Button>
                          </Link>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          </BiometricConsentGate>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </motion.div>

      <AnimatePresence>
        {selectedPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setSelectedPreview(null)}
          >
            <button className="absolute top-8 right-8 text-white hover:text-primary transition-colors">
              <X className="w-8 h-8" />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={selectedPreview} 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
