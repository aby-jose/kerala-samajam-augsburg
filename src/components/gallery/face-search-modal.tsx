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

const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/";

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
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
              {isCameraActive ? "Take a Selfie" : "Find My Photos"}
            </h2>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
              {isCameraActive ? "Align your face in the center" : "AI-Powered Facial Recognition"}
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
              <p className="text-center text-[10px] text-muted-foreground font-black uppercase tracking-widest">
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
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="rounded-xl font-bold text-xs">Change Photo</Button>
                        <Button variant="secondary" onClick={startCamera} className="rounded-xl font-bold text-xs bg-white/20 text-white border-white/10">Take New Photo</Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 space-y-4">
                      <div className="flex justify-center gap-3">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="h-16 w-16 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-all"
                        >
                          <Upload className="w-6 h-6" />
                          <span className="text-[8px] font-bold mt-1 uppercase">Upload</span>
                        </div>
                        <div 
                          onClick={startCamera}
                          className="h-16 w-16 rounded-2xl bg-zinc-900 flex flex-col items-center justify-center text-white border border-white/10 cursor-pointer hover:bg-zinc-800 transition-all shadow-xl"
                        >
                          <Camera className="w-6 h-6" />
                          <span className="text-[8px] font-bold mt-1 uppercase">Camera</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-foreground">Reference Photo</p>
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Take a selfie or upload one</p>
                      </div>
                    </div>
                  )}

                  {isSearching && (
                    <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <Zap className="w-8 h-8 animate-pulse text-primary" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-primary">AI Analyzing...</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-muted/20 rounded-2xl border border-border/40">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> Privacy Note
                  </h4>
                  {/*
                    The old wording said nothing was stored at all, which read
                    as if no biometrics existed — while face descriptors for
                    gallery photos are held server-side. Both halves are stated
                    now so the note is actually accurate.
                  */}
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">
                    Your reference photo is processed in your browser and is never
                    uploaded. Face descriptors for gallery photos are stored on our
                    servers and deleted with the photo — see the{" "}
                    <Link href="/legal/privacy" className="not-italic font-semibold text-primary underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    Discovered Moments
                  </h3>
                  <Badge variant="outline" className="rounded-lg font-bold text-[10px]">
                    {results.length} Matches Found
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {results.length === 0 ? (
                    <div className="col-span-full py-20 text-center opacity-30">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">No matching photos yet</p>
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
                            <Button variant="link" className="text-[9px] font-bold uppercase tracking-widest text-white hover:text-primary transition-colors">
                              View Album
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
