"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { cardSurface } from "@/components/admin/ui/surface";
import { updateAvatar } from "@/lib/account-actions";

function initialsOf(name: string | null) {
  // Mirrors the topbar avatar's initials logic in layout-client.tsx — kept
  // local rather than shared, since the two have no other reason to depend
  // on each other and this is five lines of cosmetic-only fallback.
  return (name || "Admin")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileCard({
  email,
  name,
  roleName,
  image,
}: {
  email: string;
  name: string | null;
  roleName: string;
  image: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(image);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again after an error
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await updateAvatar(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        setPhoto(result.url);
        toast.success("Profile photo updated.");
        // This card's own preview already shows the new photo via local
        // state above — this is for everything else that reads the photo
        // off the server (the topbar in layout.tsx), which otherwise
        // wouldn't see it until the next full navigation.
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong uploading that photo. Please try again.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setIsUploading(false);
    }
  };

  const displayImage = preview || photo;

  return (
    <section className={`${cardSurface} flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left`}>
      <div className="relative shrink-0">
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary to-primary/60 text-xl font-bold text-primary-foreground shadow-sm shadow-primary/40">
          {displayImage ? (
            <img src={displayImage} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(name)
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label="Change profile photo"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-60 dark:border-black"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      <div className="min-w-0">
        <h2 className="font-sans text-lg font-bold tracking-tight text-foreground">{name || "Administrator"}</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
        <span className="mt-2 inline-flex items-center rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:bg-white/[0.08]">
          {roleName}
        </span>
      </div>
    </section>
  );
}
