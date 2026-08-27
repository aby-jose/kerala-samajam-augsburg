"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  LogOut,
  ShieldCheck,
  Mail,
  ExternalLink,
  History,
  Ticket,
  Pencil,
  Phone,
  MapPin,
  Briefcase,
  Cake,
  FileText,
  Save,
  Camera,
  Globe,
  Loader2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MembershipSuccessOverlay from "./membership-success-overlay";
import PaymentInstructions from "./payment-instructions";
import { getMembershipPaymentDetails } from "@/lib/membership-actions";
import { displayStatus, isTermRunning } from "@/lib/membership-term";
import { updateProfile } from "@/lib/profile-actions";
import { PrivacyPanel } from "@/components/legal/privacy-panel";
import FaceSearchModal from "@/components/gallery/face-search-modal";
import { uploadProfileImage } from "@/lib/upload-actions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileClientProps {
  user: any;
  subscriptions: any[];
  registrations: any[];
}

export default function ProfileClient({ user, subscriptions, registrations }: ProfileClientProps) {
  const searchParams = useSearchParams();
  // The navbar reads name/photo from the session, not the database, so a
  // saved edit needs to push into the JWT too — otherwise it's correct here
  // and stale everywhere else until the token's periodic refresh catches up.
  const { update: updateSession } = useSession();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [isFaceSearchOpen, setIsFaceSearchOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(user.image || null);
  const [paymentDetails, setPaymentDetails] =
    useState<Awaited<ReturnType<typeof getMembershipPaymentDetails>>>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSuccess = searchParams.get("success") === "membership";

  // A term whose end date has passed is expired whether or not anything got
  // around to rewriting the row — nothing sweeps the database now.
  const activeSub = subscriptions.find(s => isTermRunning(s));
  const awaitingPaymentSub = subscriptions.find(s => s.status === "AWAITING_PAYMENT");
  const pendingSub = subscriptions.find(s =>
    ["AWAITING_PAYMENT", "PENDING_VERIFICATION"].includes(s.status)
  );

  // Only fetched when there is something to pay — it carries bank details.
  useEffect(() => {
    if (!awaitingPaymentSub) {
      setPaymentDetails(null);
      return;
    }
    let cancelled = false;
    getMembershipPaymentDetails()
      .then(details => { if (!cancelled) setPaymentDetails(details); })
      .catch(() => { /* the panel simply stays collapsed */ });
    return () => { cancelled = true; };
  }, [awaitingPaymentSub?.id]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      address: user.address || "",
      city: user.city || "",
      zip: user.zip || "",
      dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : "",
      occupation: user.occupation || "",
      bio: user.bio || "",
      image: user.image || "",
    }
  });

  const onUpdateProfile = async (data: ProfileFormValues) => {
    setFormError(null);
    setFormSuccess(false);
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFormSuccess(true);
        setIsEditing(false);
        updateSession();
        setTimeout(() => setFormSuccess(false), 3000);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadProfileImage(formData);
      if (result.error) {
        setFormError(result.error);
      } else if (result.url) {
        setProfileImage(result.url);
        setValue("image", result.url);
        
        const updateResult = await updateProfile({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          address: user.address || "",
          city: user.city || "",
          zip: user.zip || "",
          dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : "",
          occupation: user.occupation || "",
          bio: user.bio || "",
          image: result.url,
        });

        if (updateResult.error) {
          setFormError(updateResult.error);
        } else {
          setFormSuccess(true);
          updateSession();
          setTimeout(() => setFormSuccess(false), 3000);
        }
      }
    } catch (err) {
      setFormError("An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  // There is no "pay now" and no self-service cancellation any more: payments
  // are recorded by the committee, and with no recurring charge there is
  // nothing for a member to stop. Membership questions go to the committee.

  const latestSub = [...subscriptions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <main className="min-h-screen pt-36 pb-24 bg-background text-foreground">
      {showSuccess && latestSub && <MembershipSuccessOverlay subscription={latestSub} />}
      
      <Container className="max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Fixed Sidebar */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-36">
            
            {/* Tab Navigation */}
            <div className="bg-card border border-border rounded-xl p-2 shadow-sm flex flex-col gap-1">
              <button 
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                  activeTab === "profile" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <User className="w-4 h-4" /> Personal Profile
              </button>
              <button 
                onClick={() => setActiveTab("memories")}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                  activeTab === "memories" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <Camera className="w-4 h-4" /> My Moments (AI)
              </button>
              <button 
                onClick={() => setActiveTab("registrations")}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                  activeTab === "registrations" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <Ticket className="w-4 h-4" /> Event Tickets
              </button>
              <button 
                onClick={() => setActiveTab("payments")}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                  activeTab === "payments" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <History className="w-4 h-4" /> Payment History
              </button>
              <button
                onClick={() => setActiveTab("privacy")}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all",
                  activeTab === "privacy" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-secondary text-muted-foreground"
                )}
              >
                <ShieldCheck className="w-4 h-4" /> Privacy &amp; Consent
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
               <div className="text-center space-y-6">
                  <div className="relative inline-block">
                    <div className="h-32 w-32 rounded-xl bg-secondary border border-border flex items-center justify-center overflow-hidden">
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-14 w-14 text-muted-foreground" />
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                           <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center shadow-lg border-4 border-card hover:scale-105 transition-transform"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
                    <div className="flex flex-wrap justify-center gap-2">
                       {/* Every signed-in account's role is MEMBER, so printing
                           it told the reader nothing — and sitting beside
                           "Guest" it contradicted the status next to it. It
                           earns a pill only when it is not the default. */}
                       {user.role !== "MEMBER" && (
                         <StatusPill tone="neutral">{user.role}</StatusPill>
                       )}
                       {activeSub ? (
                         <StatusPill tone="active">Active Member</StatusPill>
                       ) : pendingSub ? (
                         <StatusPill tone="pending">
                            {pendingSub.status === "AWAITING_PAYMENT" ? "Payment Pending" : "Pending Verification"}
                         </StatusPill>
                       ) : displayStatus(latestSub) === "EXPIRED" ? (
                         <StatusPill tone="pending">Expired</StatusPill>
                       ) : (
                         <StatusPill tone="quiet">Guest</StatusPill>
                       )}
                    </div>
                  </div>
               </div>

               <div className="mt-8 pt-6 border-t border-border space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {activeSub && (
                    <>
                      <div className="flex items-center gap-4 text-sm text-emerald-600 font-bold uppercase tracking-wider">
                         <ShieldCheck className="h-4 w-4" /> Verified Member
                      </div>
                      <div className="flex items-center justify-between text-xs">
                         <span className="text-muted-foreground font-medium">Member since</span>
                         <span className="font-bold">{formatDate(activeSub.startDate)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                         <span className="text-muted-foreground font-medium">Valid until</span>
                         <span className="font-bold">{formatDate(activeSub.endDate)}</span>
                      </div>
                    </>
                  )}
                  {displayStatus(latestSub) === "EXPIRED" && (
                    <div className="flex items-start gap-4 text-xs text-amber-600 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                       <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                       <div>
                          <p className="font-bold">Membership Expired</p>
                          <p className="mt-0.5 opacity-80 font-medium">
                             Ended on {formatDate(latestSub.endDate)}. Renew from the membership page.
                          </p>
                       </div>
                    </div>
                  )}
               </div>

               <div className="mt-8 space-y-3">
                  <Button
                    onClick={() => signOut()}
                    variant="outline" 
                    className="w-full h-11 rounded-lg text-xs font-bold border-border hover:bg-muted/50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" /> Log Out
                  </Button>
               </div>
            </div>

            {/* Quick Status Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground font-medium">Member Since</span>
                     <span className="font-bold">{new Date(user.createdAt).getFullYear()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-muted-foreground font-medium">Registrations</span>
                     <StatusPill tone="neutral" className="tracking-normal tabular-nums">{registrations.length}</StatusPill>
                  </div>
                  {activeSub && (
                    <div className="pt-4 border-t border-border">
                       <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Membership ID</p>
                       <code className="text-xs font-mono font-bold text-foreground">#{user.id.substring(user.id.length - 8).toUpperCase()}</code>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Right Column: Main Content */}
          <div className="lg:col-span-8 space-y-8">
            
            {activeTab === "profile" && (
              <>
                {/*
                  Awaiting payment. This is where the "Pay now" button used to
                  open a checkout session; the member now needs the bank
                  details and the reference instead, and a clear statement that
                  nothing starts until the committee records the money.
                */}
                {awaitingPaymentSub && paymentDetails && (
                  <div className="bg-card border border-amber-500/30 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-border bg-amber-500/5 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <div>
                        <h2 className="text-lg font-bold">Payment Pending</h2>
                        <p className="text-xs text-muted-foreground">
                          Your {paymentDetails.planName} application is accepted and waiting on payment.
                        </p>
                      </div>
                    </div>
                    <div className="p-8">
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
                  </div>
                )}

                {pendingSub?.status === "PENDING_VERIFICATION" && (
                  <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-8 py-6 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        Your student ID is being reviewed. We will email you the payment details
                        once it is verified.
                      </p>
                    </div>
                  </div>
                )}

                {/* Identity Details Section */}
                <div id="personal-details" className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                   <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-muted/30">
                      <h2 className="text-lg font-bold">Personal Information</h2>
                      {!isEditing ? (
                        <Button 
                          onClick={() => setIsEditing(true)}
                          size="sm"
                          variant="outline"
                          className="text-xs font-bold h-8"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Details
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                           <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-xs h-8">Cancel</Button>
                           <Button size="sm" onClick={handleSubmit(onUpdateProfile)} disabled={isPending} className="text-xs h-8 px-4">
                              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Changes"}
                           </Button>
                        </div>
                      )}
                   </div>

                   <div className="p-8">
                      {formSuccess && (
                        <div className="mb-6 bg-emerald-500/10 text-emerald-600 text-xs font-bold py-3 px-4 rounded-lg border border-emerald-500/20">
                          Profile updated successfully
                        </div>
                      )}
                      {formError && (
                        <div className="mb-6 bg-destructive/10 text-destructive text-xs font-bold py-3 px-4 rounded-lg border border-destructive/20">
                          {formError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                        <InputField label="Full Name" register={register("name")} error={errors.name?.message} isEditing={isEditing} value={user.name} icon={User} />
                        <InputField label="Email Address" register={register("email")} error={errors.email?.message} isEditing={isEditing} value={user.email} icon={Mail} type="email" />
                        <InputField label="Phone Number" register={register("phone")} isEditing={isEditing} value={user.phone} icon={Phone} placeholder="+49..." />
                        <InputField label="Occupation" register={register("occupation")} isEditing={isEditing} value={user.occupation} icon={Briefcase} />
                        <InputField label="Date of Birth" register={register("dob")} isEditing={isEditing} value={user.dob ? formatDate(user.dob) : null} icon={Calendar} type="date" />
                        <InputField label="Street Address" register={register("address")} isEditing={isEditing} value={user.address} icon={MapPin} />
                        <InputField label="City" register={register("city")} isEditing={isEditing} value={user.city} icon={Globe} />
                        <InputField label="ZIP Code" register={register("zip")} isEditing={isEditing} value={user.zip} icon={MapPin} />
                        <div className="md:col-span-2">
                          <InputField label="Biography" register={register("bio")} isEditing={isEditing} value={user.bio} icon={FileText} isTextArea />
                        </div>
                      </div>
                   </div>
                </div>
              </>
            )}

            {activeTab === "memories" && (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                <div className="px-8 py-6 border-b border-border flex justify-between items-center bg-muted/30">
                  <h2 className="text-lg font-bold">My Moments</h2>
                  <Badge variant="outline" className="text-[10px] font-bold border-border">AI-Powered</Badge>
                </div>
                <div className="p-12 text-center space-y-6">
                  <div className="h-24 w-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="text-xl font-bold">Discover yourself in our gallery</h3>
                    {/* The reference shot is taken or uploaded inside the modal,
                        so this no longer waits on a profile photo being set —
                        gating it on one left members without a picture with a
                        button they could never reach. */}
                    <p className="text-sm text-muted-foreground">Take a selfie or upload a photo and our AI will match it against every event album. Your reference photo is processed in your browser and never uploaded.</p>
                  </div>
                  <Button
                    onClick={() => setIsFaceSearchOpen(true)}
                    className="h-12 px-10 rounded-xl font-bold bg-primary shadow-xl shadow-primary/20"
                  >
                    Find My Photos
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "registrations" && (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                 <div className="px-8 py-6 border-b border-border flex justify-between items-center">
                    <h2 className="text-lg font-bold">Event Registrations</h2>
                    <Badge variant="outline" className="text-[10px] font-bold border-border">{registrations.length} Total</Badge>
                 </div>
                 <div className="divide-y divide-border">
                    {registrations.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground text-sm italic">No registrations found.</div>
                    ) : registrations.map((reg) => (
                      <div key={reg.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-muted/30 transition-colors">
                         <div className="flex items-center gap-5">
                            <div className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0">
                               <img src={reg.event.imageUrl || "/images/placeholder.svg"} alt="" className="h-full w-full object-cover" />
                            </div>
                            <div>
                               <h4 className="font-bold">{reg.event.title}</h4>
                               <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" /> {formatDate(reg.event.date)}
                               </p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <StatusPill tone={reg.paymentStatus === "PAID" ? "active" : "pending"}>
                               {reg.paymentStatus === "PAID" ? "Confirmed" : "Pending"}
                            </StatusPill>
                            <Link href={`/events/${reg.event.slug || reg.event.id}`}>
                               <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg border border-border text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></Button>
                            </Link>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                 <div className="px-8 py-6 border-b border-border bg-muted/20">
                    <h2 className="text-lg font-bold">Payment History</h2>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-muted/50 border-b border-border">
                         <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <th className="px-8 py-4">Description</th>
                            <th className="px-8 py-4">Status</th>
                            <th className="px-8 py-4">Date</th>
                            <th className="px-8 py-4 text-right">Value</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                         {/*
                           `startDate` is the day the payment was recorded, so
                           it is the only honest date for a paid row. An
                           unpaid application has none and shows when it was
                           submitted instead — the old table showed
                           `createdAt` for everything, which made an
                           outstanding application look settled.
                         */}
                         {subscriptions.map((sub) => {
                           const paid = sub.paymentStatus === "PAID";
                           return (
                             <tr key={sub.id} className="text-sm hover:bg-muted/10 transition-colors">
                                <td className="px-8 py-5">
                                   <p className="font-bold">{sub.plan.name} Membership</p>
                                   <p className="text-[10px] text-muted-foreground uppercase font-bold mt-0.5">
                                     {sub.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "Cash"}
                                   </p>
                                </td>
                                <td className="px-8 py-5">
                                   <StatusPill tone={paid ? "active" : "pending"}>
                                     {paid ? "Paid" : "Awaiting payment"}
                                   </StatusPill>
                                </td>
                                <td className="px-8 py-5 text-muted-foreground">
                                   {paid ? formatDate(sub.startDate) : `Applied ${formatDate(sub.createdAt)}`}
                                </td>
                                <td className="px-8 py-5 text-right font-bold tabular-nums">€{sub.plan.price.toFixed(2)}</td>
                             </tr>
                           );
                         })}
                      </tbody>
                   </table>
                   {subscriptions.length === 0 && (
                      <div className="p-12 text-center text-muted-foreground text-sm italic">No payment transactions found.</div>
                   )}
                 </div>
              </div>
            )}

            {activeTab === "privacy" && <PrivacyPanel />}
          </div>
        </div>
      </Container>

      {/* Art. 9 consent is enforced inside the modal and again server-side in
          searchMediaByFace, so nothing here needs to pre-check it. */}
      <FaceSearchModal
        isOpen={isFaceSearchOpen}
        onClose={() => setIsFaceSearchOpen(false)}
      />
    </main>
  );
}

/**
 * A status pill.
 *
 * `variant="outline"` is deliberate. Badge's default variant carries
 * `hover:bg-primary/80`, and since `hover:bg-*` is a different utility key
 * from `bg-*`, passing `bg-secondary` in `className` never displaced it —
 * so every one of these labels turned crimson under the cursor, keeping its
 * old dark text. They report state and cannot be clicked, so they take no
 * hover treatment at all.
 */
const PILL_TONES = {
  neutral: "bg-secondary text-secondary-foreground border-transparent",
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  quiet: "bg-muted text-muted-foreground border-border",
} as const;

function StatusPill({
  tone,
  className,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </Badge>
  );
}

function InputField({ label, register, error, isEditing, value, placeholder, type = "text", isTextArea = false, icon: Icon }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pl-0.5">
         <Icon className="h-3 w-3 text-muted-foreground/50" />
         <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {isEditing ? (
        <div className="space-y-1">
          {isTextArea ? (
            <textarea 
              {...register}
              placeholder={placeholder}
              rows={3}
              className={cn(
                "w-full bg-background border border-border rounded-lg p-3 text-sm outline-none focus:border-primary transition-all resize-none",
                error && "border-destructive/50"
              )}
            />
          ) : (
            <input 
              {...register}
              type={type}
              placeholder={placeholder}
              className={cn(
                "w-full h-11 bg-background border border-border rounded-lg px-4 text-sm outline-none focus:border-primary transition-all",
                error && "border-destructive/50"
              )}
            />
          )}
          {error && <p className="text-[10px] text-destructive font-bold pl-1">{error}</p>}
        </div>
      ) : (
        <div className="h-11 flex items-center px-4 rounded-lg bg-secondary/50 border border-transparent text-sm font-medium">
          {value || <span className="text-muted-foreground/30 italic font-normal">Not provided</span>}
        </div>
      )}
    </div>
  );
}
