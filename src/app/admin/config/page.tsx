"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Save, 
  Loader2, 
  Globe, 
  Palette, 
  Mail, 
  Share2, 
  Settings2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const configSchema = z.object({
  siteName: z.string().min(2),
  siteDescription: z.string().min(10),
  contactEmail: z.string().email(),
  branding: z.object({
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
    secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
  }),
  socials: z.object({
    facebook: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
  }),
});

type ConfigFormValues = z.infer<typeof configSchema>;

const tabs = [
  { id: "general", label: "General", icon: Globe },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "email", label: "Email", icon: Mail },
  { id: "socials", label: "Socials", icon: Share2 },
];

export default function AdminConfigPage() {
  const [activeTab, setActiveTab] = React.useState("general");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      siteName: "Kerala Samajam Augsburg",
      siteDescription: "The official platform for the Kerala community in Augsburg, Germany.",
      contactEmail: "info@ksaugsburg.de",
      branding: {
        primaryColor: "#e11d48",
        secondaryColor: "#4f46e5",
      },
    },
  });

  const onSubmit = async (data: ConfigFormValues) => {
    setIsLoading(true);
    setIsSaved(false);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Saving config:", data);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const primaryColor = watch("branding.primaryColor");

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
          <p className="text-muted-foreground">Customize branding, social links, and global settings.</p>
        </div>
        <Button 
          onClick={handleSubmit(onSubmit)} 
          className="h-11 px-8 font-bold shadow-lg shadow-primary/10"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isLoading ? "Saving..." : isSaved ? "Changes Saved" : "Save Configuration"}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-primary"
              )}
            >
              <tab.icon className={cn("mr-3 h-4 w-4", activeTab === tab.id ? "text-white" : "group-hover:text-primary")} />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1">
          <form className="space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === "general" && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <CardTitle className="text-lg">General Settings</CardTitle>
                      <CardDescription>Basic information about the platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="siteName">Site Name</Label>
                        <Input id="siteName" {...register("siteName")} className="h-11" />
                        {errors.siteName && <p className="text-xs text-destructive">{errors.siteName.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siteDescription">Site Description</Label>
                        <textarea 
                          id="siteDescription" 
                          {...register("siteDescription")}
                          rows={4}
                          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">Global Contact Email</Label>
                        <Input id="contactEmail" {...register("contactEmail")} className="h-11" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === "branding" && (
                <motion.div
                  key="branding"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <CardTitle className="text-lg">Visual Branding</CardTitle>
                      <CardDescription>Control the look and feel of the website.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <Label>Primary Brand Color</Label>
                          <div className="flex items-center space-x-4">
                            <div 
                              className="h-12 w-12 rounded-xl border-4 border-white shadow-xl ring-1 ring-border"
                              style={{ backgroundColor: primaryColor }}
                            />
                            <Input {...register("branding.primaryColor")} className="h-11 font-mono uppercase" />
                          </div>
                          {errors.branding?.primaryColor && (
                            <p className="text-xs text-destructive">{errors.branding.primaryColor.message}</p>
                          )}
                        </div>
                        <div className="space-y-4">
                          <Label>Secondary Color</Label>
                          <div className="flex items-center space-x-4">
                            <div 
                              className="h-12 w-12 rounded-xl border-4 border-white shadow-xl ring-1 ring-border"
                              style={{ backgroundColor: watch("branding.secondaryColor") }}
                            />
                            <Input {...register("branding.secondaryColor")} className="h-11 font-mono uppercase" />
                          </div>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-zinc-900 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Palette className="h-20 w-20" />
                        </div>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Preview Box</h4>
                        <div className="space-y-4">
                          <div className="h-2 w-24 rounded-full" style={{ backgroundColor: primaryColor }} />
                          <h3 className="text-xl font-bold">Main Title Example</h3>
                          <p className="text-sm text-white/60">This is how fonts and primary accents will look together.</p>
                          <Button 
                            type="button" 
                            className="h-10 px-6 font-bold"
                            style={{ backgroundColor: primaryColor }}
                          >
                            Call to Action
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeTab === "socials" && (
                <motion.div
                  key="socials"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <CardTitle className="text-lg">Social Media Links</CardTitle>
                      <CardDescription>Connect with community members on other platforms.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Facebook URL</Label>
                          <Input {...register("socials.facebook")} placeholder="https://fb.com/..." className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label>Instagram URL</Label>
                          <Input {...register("socials.instagram")} placeholder="https://instagr.am/..." className="h-11" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
              
              {activeTab === "email" && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <CardTitle className="text-lg">Email Service Settings</CardTitle>
                      <CardDescription>Manage how emails are sent from the system.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6 text-center py-20">
                      <div className="max-w-xs mx-auto space-y-4">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                          <Mail className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h4 className="font-bold">Email Service (Resend)</h4>
                        <p className="text-sm text-muted-foreground">
                          Email service is currently using the API key from environment variables.
                        </p>
                        <Button variant="outline" className="w-full">
                          Test Email Service
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </div>
  );
}
