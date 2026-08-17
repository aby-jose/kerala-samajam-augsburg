"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Landmark,
  Banknote,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Plus,
  Trash2,
  User,
  GraduationCap,
  Info,
  Mail,
  ArrowRight,
  ShieldAlert,
  Upload,
  FileText,
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCcw,
  Ban,
  MapPin, 
  Home, 
  Building 
} from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMembershipSubscription,
  getDetailedMemberStatus,
  getMembershipPaymentDetails,
  resetRejectedSubscription
} from "@/lib/membership-actions";
import { PAYMENT_METHODS, isTermRunning, termLabel, type PaymentMethod } from "@/lib/membership-term";
import { sendVerificationOTP, verifyOTP, uploadStudentId } from "@/lib/verification-actions";
import { cn } from "@/lib/utils";
import { ConsentCheckbox, LegalLink } from "@/components/legal/consent-checkbox";
import { ConsentBlockedNotice, useLegalConsent } from "@/components/legal/consent-gate";
import { Badge } from "@/components/ui/badge";
import { updateProfile } from "@/lib/profile-actions";
import PaymentInstructions from "./payment-instructions";

interface MembershipFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: any;
  user: any;
}

type ModalState = "LOADING" | "ALREADY_MEMBER" | "PENDING_REVIEW" | "AWAITING_PAYMENT" | "REJECTED" | "FORM";

type PaymentDetails = Awaited<ReturnType<typeof getMembershipPaymentDetails>>;

export default function MembershipFormModal({ 
  isOpen, 
  onClose, 
  plan, 
  user 
}: MembershipFormModalProps) {
  // Navigation & Data State
  const [modalState, setModalState] = useState<ModalState>("LOADING");
  const [step, setStep] = useState<"VERIFY" | "ADDRESS" | "DETAILS" | "PAYMENT">("VERIFY");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [existingSub, setExistingSub] = useState<any>(null);
  
  // Verification State
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  
  // Student ID State
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUrl, setIdUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [address, setAddress] = useState({ street: "", city: "", zip: "" });
  const [institution, setInstitution] = useState("");
  const [familyMembers, setFamilyMembers] = useState<{name: string, relation: 'ADULT' | 'CHILD'}[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PAYMENT_METHODS.BANK_TRANSFER);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedWithdrawal, setAcknowledgedWithdrawal] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const { hasPending: hasPendingConsent, promptConsent } = useLegalConsent();

  const isStudentPlan = plan.name.toLowerCase().includes("student");
  const isFamilyPlan = plan.name.toLowerCase().includes("family");

  // Initial Status Check
  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen, plan.id]);

  const checkStatus = async () => {
    setModalState("LOADING");
    setIsSuccess(false); 
    try {
      const data = await getDetailedMemberStatus();
      if (!data) {
        setModalState("FORM");
        return;
      }

      const { emailVerified, subscription } = data;
      setExistingSub(subscription);

      if (emailVerified) {
        if (!data.addressComplete) {
          setStep("ADDRESS");
        } else {
          setStep("DETAILS");
        }
      }
      
      if (data.address) {
        setAddress(data.address);
      }

      if (subscription) {
        // A lapsed term must fall through to the form — this is the whole
        // renewal path, and testing `status === "ACTIVE"` alone would tell an
        // expired member they were already a member and leave them stuck.
        if (isTermRunning(subscription)) {
           setModalState("ALREADY_MEMBER");
        } else if (subscription.status === "PENDING_VERIFICATION") {
           setModalState("PENDING_REVIEW");
        } else if (subscription.status === "AWAITING_PAYMENT") {
           // The member has applied and we are waiting on the money — show
           // them how to send it rather than the join form again.
           setPaymentDetails(await getMembershipPaymentDetails());
           setModalState("AWAITING_PAYMENT");
        } else if (subscription.status === "REJECTED") {
           setModalState("REJECTED");
        } else {
           setModalState("FORM");
        }
      } else {
        setModalState("FORM");
      }
    } catch (error) {
      setModalState("FORM");
    }
  };

  const handleResetApplication = async () => {
    if (!existingSub) return;
    setIsSubmitting(true);
    try {
      await resetRejectedSubscription(existingSub.id);
      setExistingSub(null);
      setIdUrl("");
      setIdFile(null);
      setInstitution("");
      setFamilyMembers([]);
      setStep("DETAILS"); 
      setIsSuccess(false);
      setModalState("FORM");
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOTP = async () => {
    setIsVerifying(true);
    setVerificationError("");
    try {
      await sendVerificationOTP();
      setIsOtpSent(true);
    } catch (error: any) {
      setVerificationError(error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOTP = async () => {
    setIsVerifying(true);
    setVerificationError("");
    try {
      const result = await verifyOTP(otp);
      if (result.success) {
        checkStatus(); 
      } else {
        setVerificationError(result.message || "Invalid code");
      }
    } catch (error: any) {
      setVerificationError(error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!address.street || !address.city || !address.zip) {
      setVerificationError("All address fields are required for membership.");
      return;
    }
    
    setIsSubmitting(true);
    setVerificationError("");
    try {
      const result = await updateProfile({
        name: user.name,
        email: user.email,
        address: address.street,
        city: address.city,
        zip: address.zip
      });

      if (result.success) {
        setStep("DETAILS");
      } else {
        setVerificationError(result.error || "Failed to update address");
      }
    } catch (error: any) {
      setVerificationError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("File size must be less than 1MB");
      return;
    }

    setIdFile(file);
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadStudentId(formData) as any;
      setIdUrl(result.url);
    } catch (error: any) {
      alert(error.message || "Failed to upload ID");
      setIdFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    // The student path submits an application for review rather than paying,
    // so it has its own consent tick further up; everything else routes
    // through the payment step and must be ticked there.
    if (isStudentPlan && !acceptedTerms) {
      setConsentError("Please accept the Terms of Use and Privacy Policy.");
      return;
    }

    if (!isStudentPlan && (!acceptedTerms || !acknowledgedWithdrawal)) {
      setConsentError("Please confirm both statements to continue.");
      return;
    }

    if (hasPendingConsent) {
      promptConsent();
      return;
    }

    setIsSubmitting(true);
    const details: any = {};
    if (isStudentPlan) {
      details.institution = institution;
      details.studentIdUrl = idUrl;
    }
    if (isFamilyPlan) details.familyMembers = familyMembers;

    setConsentError(null);

    try {
      const result = await createMembershipSubscription({
        planId: plan.id,
        paymentMethod,
        details
      });

      if (result.success) {
        // Non-student applications go straight to awaiting payment, so the
        // success screen can show the bank details right away.
        if (result.status === "AWAITING_PAYMENT") {
          setPaymentDetails(await getMembershipPaymentDetails());
        }
        setIsSuccess(true);
      }
    } catch (error: any) {
      console.error("Subscription failed:", error);
      setConsentError(error?.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addFamilyMember = () => {
    if (familyMembers.length >= 4) return;
    const relation = familyMembers.filter(m => m.relation === 'ADULT').length < 2 ? 'ADULT' : 'CHILD';
    setFamilyMembers([...familyMembers, { name: "", relation }]);
  };

  const removeFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const updateFamilyMember = (index: number, name: string) => {
    const newMembers = [...familyMembers];
    newMembers[index].name = name;
    setFamilyMembers(newMembers);
  };

  if (!isOpen) return null;

  const renderModalContent = () => {
    if (modalState === "LOADING") {
       return (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
             <Loader2 className="h-10 w-10 animate-spin text-primary" />
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Checking status...</p>
          </div>
       );
    }

    if (modalState === "REJECTED") {
       return (
          <div className="py-12 text-center space-y-6">
             <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Ban className="h-10 w-10 text-destructive" />
             </div>
             <div className="space-y-2 px-8">
                <h3 className="text-xl font-serif">Application Status Update</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   Unfortunately, your recent student membership application was not approved.
                </p>
                <div className="mt-6 p-6 rounded-2xl bg-destructive/5 border border-destructive/20 text-left">
                   <p className="text-[10px] font-black uppercase tracking-widest text-destructive mb-2">Reason for Rejection</p>
                   <p className="text-sm font-medium text-foreground leading-relaxed italic">
                      &ldquo;{(existingSub?.details as any)?.rejectionReason || "No specific reason provided."}&rdquo;
                   </p>
                </div>
                <div className="pt-8 space-y-3">
                   <Button 
                      onClick={handleResetApplication} 
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-[11px] tracking-tight shadow-xl shadow-primary/20"
                   >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                      Start New Application
                   </Button>
                   <Button onClick={onClose} variant="ghost" className="w-full h-10 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100">Cancel</Button>
                </div>
             </div>
          </div>
       );
    }

    if (modalState === "PENDING_REVIEW") {
       return (
          <div className="py-12 text-center space-y-6">
             <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Clock className="h-10 w-10 text-primary animate-pulse" />
             </div>
             <div className="space-y-2 px-8">
                <h3 className="text-xl font-serif">Application Under Review</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   You have already submitted a student membership application. Our administrators are currently reviewing your ID card.
                </p>
                <div className="pt-4 flex flex-col gap-3">
                   <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Status</p>
                      {/* `variant="outline"` carries no hover; the default variant's
                          `hover:bg-primary/80` is a different utility key from
                          `bg-*`, so it outlived the amber override and turned
                          this static label crimson under the cursor. */}
                      <Badge variant="outline" className="bg-amber-500 text-white border-transparent rounded-lg text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">Verification Pending</Badge>
                   </div>
                   <Button onClick={onClose} variant="outline" className="h-12 rounded-xl font-bold">Got it, thanks</Button>
                </div>
             </div>
          </div>
       );
    }

    if (modalState === "AWAITING_PAYMENT") {
       return (
          <div className="py-10 space-y-6">
             <div className="text-center space-y-2 px-8">
                <div className="h-16 w-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-xl font-serif">Awaiting Your Payment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   Your application is accepted. Your membership will begin on the day we record
                   your payment.
                </p>
             </div>

             {paymentDetails && (
               <div className="px-8">
                  <PaymentInstructions
                    data={{
                      planName: paymentDetails.planName,
                      amount: paymentDetails.amount,
                      reference: paymentDetails.reference,
                      method: paymentDetails.method,
                      bank: paymentDetails.bank,
                    }}
                  />
               </div>
             )}

             <div className="px-8">
                <Button onClick={onClose} variant="outline" className="w-full h-12 rounded-xl font-bold">
                   Got it, thanks
                </Button>
             </div>
          </div>
       );
    }

    if (modalState === "ALREADY_MEMBER") {
       return (
          <div className="py-12 text-center space-y-6">
             <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
             </div>
             <div className="space-y-2 px-8">
                <h3 className="text-xl font-serif">Active Membership Found</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                   You are already an active member of Kerala Samajam Augsburg. Thank you for your support!
                </p>
                <div className="pt-6">
                   <Button onClick={onClose} variant="outline" className="w-full h-12 rounded-xl font-bold">Close</Button>
                </div>
             </div>
          </div>
       );
    }

    if (isSuccess) {
      return (
        <div className="py-10 space-y-6">
          <div className="text-center space-y-2 px-8">
            <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              {isStudentPlan ? <Clock className="h-10 w-10 text-emerald-500" /> : <CheckCircle2 className="h-10 w-10 text-emerald-500" />}
            </div>
            <h3 className="text-xl font-serif">Application Submitted</h3>
            {/*
              Deliberately not "Welcome to the community". Nothing has been
              paid at this point, so claiming an active membership here would
              be the same mistake the old flow made by dating the term from
              the application.
            */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isStudentPlan
                ? "Your student ID has been uploaded for review. Once we have verified it we will email you the payment details."
                : "We have emailed you the payment details. Your membership begins on the day we record your payment, and we will confirm the dates then."}
            </p>
          </div>

          {!isStudentPlan && paymentDetails && (
            <div className="px-8">
               <PaymentInstructions
                 data={{
                   planName: paymentDetails.planName,
                   amount: paymentDetails.amount,
                   reference: paymentDetails.reference,
                   method: paymentDetails.method,
                   bank: paymentDetails.bank,
                 }}
               />
            </div>
          )}

          <div className="px-8">
             <Button onClick={onClose} className="w-full h-12 rounded-xl font-bold">Done</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
           {step === "VERIFY" && (
             <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 py-4">
                <div className="text-center space-y-2">
                   <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><Mail className="h-8 w-8 text-primary" /></div>
                   <h3 className="text-xl font-serif font-bold">Email Verification</h3>
                   <p className="text-sm text-muted-foreground max-w-xs mx-auto">Confirm your identity at <b>{user.email}</b> to proceed.</p>
                </div>

                <div className="space-y-6">
                   {!isOtpSent ? (
                      <Button onClick={handleSendOTP} disabled={isVerifying} className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                         {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                         Send Verification Code
                      </Button>
                   ) : (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                         <div className="flex justify-center gap-2">
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                               <input
                                  key={index} id={`otp-${index}`} type="text" maxLength={1} value={otp[index] || ""}
                                  onChange={(e) => {
                                     const value = e.target.value; if (!/^\d*$/.test(value)) return;
                                     const newOtp = otp.split(""); newOtp[index] = value; setOtp(newOtp.join(""));
                                     if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Backspace" && !otp[index] && index > 0) document.getElementById(`otp-${index - 1}`)?.focus(); }}
                                  className="w-10 h-14 text-center text-xl font-bold rounded-xl bg-secondary/30 border-2 border-border focus:border-primary outline-none transition-all"
                               />
                            ))}
                         </div>
                         <Button onClick={handleVerifyOTP} disabled={isVerifying || otp.length !== 6} className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                            Verify Identity
                         </Button>
                      </div>
                   )}
                   {verificationError && <p className="text-[10px] font-bold text-destructive text-center">{verificationError}</p>}
                </div>
             </motion.div>
           )}

           {step === "ADDRESS" && (
             <motion.div key="address" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 py-4">
                <div className="text-center space-y-2">
                   <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"><MapPin className="h-8 w-8 text-primary" /></div>
                   <h3 className="text-xl font-serif font-bold">Billing Address</h3>
                   <p className="text-sm text-muted-foreground max-w-xs mx-auto">We need your address for the official membership invoice.</p>
                </div>

                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Street & House Number</label>
                      <div className="relative">
                        <Home className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Am Rathausplatz 1" className="h-12 pl-12 rounded-xl" value={address.street} onChange={(e) => setAddress({...address, street: e.target.value})} />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">City</label>
                         <div className="relative">
                           <Building className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                           <Input placeholder="Augsburg" className="h-12 pl-12 rounded-xl" value={address.city} onChange={(e) => setAddress({...address, city: e.target.value})} />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Zip Code</label>
                         <Input placeholder="86150" className="h-12 rounded-xl text-center font-bold tracking-widest" value={address.zip} onChange={(e) => setAddress({...address, zip: e.target.value})} />
                      </div>
                   </div>
                   
                   {verificationError && <p className="text-[10px] font-bold text-destructive text-center">{verificationError}</p>}
                   
                   <Button onClick={handleUpdateAddress} disabled={isSubmitting} className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10 mt-4">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Save & Continue
                   </Button>
                </div>
             </motion.div>
           )}

           {step === "DETAILS" && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                 
                 {isStudentPlan && (
                    <div className="space-y-6">
                       <div className="p-6 rounded-[1.5rem] bg-secondary/20 border border-dashed border-border/60 text-center space-y-4">
                          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                             <GraduationCap className="h-6 w-6 text-primary" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-bold">Student Identity Verification</p>
                             <p className="text-[10px] text-muted-foreground leading-relaxed px-4">Upload a clear photo of your valid Student ID card. Our team will review your application manually.</p>
                          </div>

                          <div className="pt-2">
                             <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                             {!idUrl ? (
                                <Button 
                                  onClick={() => fileInputRef.current?.click()} 
                                  disabled={isUploading} 
                                  variant="outline" 
                                  className="h-11 rounded-xl border-dashed border-primary/40 hover:border-primary/60 px-8"
                                >
                                   {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                   <span className="text-[10px] font-bold uppercase tracking-widest">Choose ID Photo</span>
                                </Button>
                             ) : (
                                <div className="flex items-center justify-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                   <FileText className="h-4 w-4 text-emerald-500" />
                                   <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{idFile?.name}</span>
                                   <button onClick={() => { setIdUrl(""); setIdFile(null); }} className="p-1 hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                             )}
                             <p className="text-[9px] text-muted-foreground/60 mt-3 font-medium">Max file size: 1MB. Supported: JPG, PNG.</p>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">University / Institution</label>
                          <Input placeholder="e.g. University of Augsburg" className="h-12 rounded-xl" value={institution} onChange={(e) => setInstitution(e.target.value)} />
                       </div>
                    </div>
                 )}

                 {isFamilyPlan && (
                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Family Members (Max 2 Adults, 2 Kids)</label>
                          <Button variant="ghost" size="sm" onClick={addFamilyMember} className="h-8 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/5 uppercase tracking-widest"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                       </div>
                       <div className="space-y-3">
                          {familyMembers.map((member, index) => (
                            <div key={index} className="flex gap-2">
                               <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border", member.relation === 'ADULT' ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted border-border")}><User className={member.relation === 'ADULT' ? "w-4 h-4" : "w-3.5 h-3.5"} /></div>
                               <Input placeholder={`Name (${member.relation})`} className="h-12 rounded-xl" value={member.name} onChange={(e) => updateFamilyMember(index, e.target.value)} />
                               <Button variant="ghost" onClick={() => removeFamilyMember(index)} className="h-12 w-12 rounded-xl text-destructive/40 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {!isStudentPlan && (
                    <div className="space-y-4 pt-4">
                       <div className="p-4 rounded-xl bg-secondary/20 border border-border/40 flex items-center justify-between">
                          <span className="text-xs font-bold">Standard Details Collected</span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                       </div>
                       <Button onClick={() => setStep("PAYMENT")} className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                          Continue to Payment <ArrowRight className="h-4 w-4 ml-2" />
                       </Button>
                    </div>
                 )}

                 {isStudentPlan && (
                    <div className="pt-4 space-y-4">
                       {/* No payment step on this path, so consent is taken
                           here — a student ID is a document about an
                           identifiable person and must not be uploaded
                           without agreement. */}
                       <ConsentCheckbox
                          checked={acceptedTerms}
                          onChange={(value) => {
                             setAcceptedTerms(value);
                             if (value) setConsentError(null);
                          }}
                          error={consentError}
                       >
                          I accept the <LegalLink slug="terms">Terms of Use</LegalLink> and
                          have read the <LegalLink slug="privacy">Privacy Policy</LegalLink>,
                          including how my proof of student status is handled.
                       </ConsentCheckbox>

                       <Button
                         onClick={handleSubmit}
                         disabled={isSubmitting || !idUrl || !institution || !acceptedTerms}
                         className="w-full h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10"
                       >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                          Submit Application for Review
                       </Button>
                    </div>
                 )}
              </motion.div>
           )}

           {step === "PAYMENT" && !isStudentPlan && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                 <div className="space-y-3">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                     How would you like to pay?
                   </p>
                   <div className="grid grid-cols-2 gap-4">
                     <button
                       onClick={() => setPaymentMethod(PAYMENT_METHODS.BANK_TRANSFER)}
                       className={cn(
                         "flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all",
                         paymentMethod === PAYMENT_METHODS.BANK_TRANSFER
                           ? "border-primary bg-primary/5 shadow-sm"
                           : "border-border bg-background hover:border-primary/40"
                       )}
                     >
                       <Landmark className={cn("h-6 w-6", paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ? "text-primary" : "text-muted-foreground")} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Bank transfer</span>
                     </button>
                     <button
                       onClick={() => setPaymentMethod(PAYMENT_METHODS.CASH)}
                       className={cn(
                         "flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all",
                         paymentMethod === PAYMENT_METHODS.CASH
                           ? "border-primary bg-primary/5 shadow-sm"
                           : "border-border bg-background hover:border-primary/40"
                       )}
                     >
                       <Banknote className={cn("h-6 w-6", paymentMethod === PAYMENT_METHODS.CASH ? "text-primary" : "text-muted-foreground")} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Cash in person</span>
                     </button>
                   </div>
                 </div>

                 {/*
                   § 312j Abs. 2 BGB requires the essential terms to sit
                   directly above the order button, not a scroll away.
                 */}
                 <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Plan</span>
                       <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Term</span>
                       <span className="text-sm font-medium text-foreground">{termLabel(plan.duration)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Starts</span>
                       <span className="text-sm font-medium text-foreground">When we record your payment</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Total</span>
                       <span className="text-lg font-black text-primary">€{plan.price.toFixed(2)}</span>
                    </div>
                 </div>

                 <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 p-4">
                    <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                       There is no online payment. Once you submit this form we will email you the
                       {paymentMethod === PAYMENT_METHODS.CASH ? " details for paying in person" : " bank details and a payment reference"},
                       and your membership term begins on the day we record the money as received.
                    </p>
                 </div>

                 <ConsentBlockedNotice />

                 <div className="space-y-3">
                    <ConsentCheckbox
                       checked={acceptedTerms}
                       onChange={(value) => {
                          setAcceptedTerms(value);
                          if (value) setConsentError(null);
                       }}
                       error={consentError}
                    >
                       I accept the <LegalLink slug="terms">Terms of Use</LegalLink> and have
                       read the <LegalLink slug="privacy">Privacy Policy</LegalLink>.
                    </ConsentCheckbox>

                    {/* Separate from the terms tick: the withdrawal
                        instruction is its own statutory duty, and a member
                        must be able to see they were told about it. */}
                    <ConsentCheckbox
                       checked={acknowledgedWithdrawal}
                       onChange={(value) => {
                          setAcknowledgedWithdrawal(value);
                          if (value) setConsentError(null);
                       }}
                    >
                       I have been informed of my{" "}
                       <LegalLink slug="withdrawal">right of withdrawal</LegalLink> and the
                       14-day period that applies to this membership.
                    </ConsentCheckbox>
                 </div>

                 {/*
                   § 312j Abs. 3 BGB prescribes the wording on this button. A
                   label that does not make the payment obligation explicit
                   means no contract is formed at all.
                 */}
                 <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !acceptedTerms || !acknowledgedWithdrawal}
                    className="w-full h-14 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20"
                 >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Order with obligation to pay · €{plan.price.toFixed(2)}
                 </Button>

                 {consentError && (
                   <p className="text-center text-[10px] font-bold text-destructive">{consentError}</p>
                 )}
              </motion.div>
           )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-zinc-950/20 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.98 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="relative w-full max-w-2xl bg-card border border-border/40 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 bg-secondary/30 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow-sm border border-border/40">
                <ShieldCheck className="h-5 w-5 text-primary" />
             </div>
             <div>
                <h2 className="text-sm font-bold">{plan.name} {isStudentPlan ? "Application" : "Registration"}</h2>
                {modalState === "FORM" && (
                   <div className="flex gap-2 mt-1">
                      <div className={cn("h-1 w-6 rounded-full transition-colors", step === "VERIFY" ? "bg-primary" : "bg-primary/20")} />
                      <div className={cn("h-1 w-6 rounded-full transition-colors", step === "ADDRESS" ? "bg-primary" : "bg-primary/20")} />
                      <div className={cn("h-1 w-6 rounded-full transition-colors", step === "DETAILS" ? "bg-primary" : "bg-primary/20")} />
                      {!isStudentPlan && <div className={cn("h-1 w-6 rounded-full transition-colors", step === "PAYMENT" ? "bg-primary" : "bg-primary/20")} />}
                   </div>
                )}
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-all text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {renderModalContent()}

        <div className="px-8 py-4 bg-secondary/10 border-t border-border/40 text-[9px] text-muted-foreground/60 italic text-center">
           All documents are encrypted and stored securely on Cloudinary. Student verification usually takes 24-48 hours.
        </div>
      </motion.div>
    </div>
  );
}
