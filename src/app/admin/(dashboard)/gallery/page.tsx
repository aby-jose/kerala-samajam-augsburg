"use client";

import React from "react";
import { 
  Plus, 
  Trash2, 
  Filter, 
  Image as ImageIcon,
  Loader2,
  Tag,
  Eye,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Mock gallery data for admin
const mockPhotos = [
  { id: 1, url: "https://images.unsplash.com/photo-1627889163271-97b7b952f1e2", category: "Events", title: "Vishu Celebration 2024" },
  { id: 2, url: "https://images.unsplash.com/photo-1605333396915-47ed6b68a00e", category: "Community", title: "Kerala Samajam Picnic" },
  { id: 3, url: "https://images.unsplash.com/photo-1545628237-f142c13c7786", category: "Youth", title: "Malayalam Class Activity" },
  { id: 4, url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205", category: "Events", title: "Onam Feast 2024" },
];

export default function AdminGalleryPage() {
  const [isUploading, setIsUploading] = React.useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => setIsUploading(false), 2000);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gallery Management</h1>
          <p className="text-muted-foreground">Upload and organize photos for the public gallery.</p>
        </div>
        <Button className="h-11 px-6 font-bold shadow-lg" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Upload New Image
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Statistics Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Media Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Images</span>
                <span className="font-bold">42</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Storage Used</span>
                <span className="font-bold">124 MB</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Categories</span>
                <span className="font-bold">4</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["Events", "Community", "Youth", "Education"].map(cat => (
                <div key={cat} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer group transition-colors">
                  <div className="flex items-center text-sm font-medium">
                    <Tag className="mr-2 h-3.5 w-3.5 text-primary/60" />
                    {cat}
                  </div>
                  <Badge variant="outline" className="text-[10px] group-hover:bg-primary group-hover:text-primary-foreground">12</Badge>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-primary">
                <Settings className="mr-2 h-3 w-3" />
                Manage Categories
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Gallery Grid */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-border/40 shadow-sm">
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" className="bg-muted font-bold px-4">All</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground font-medium px-4">Drafts</Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="mr-2 h-3.5 w-3.5" />
                Filter
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {mockPhotos.map((photo) => (
              <Card key={photo.id} className="border-none shadow-sm group overflow-hidden bg-background">
                <div className="relative aspect-video overflow-hidden">
                  <img src={photo.url} alt={photo.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full shadow-lg">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" className="h-9 w-9 rounded-full shadow-lg bg-red-500 hover:bg-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-white/90 text-black border-none font-bold text-[10px]">{photo.category}</Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="font-bold text-sm truncate">{photo.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Uploaded on 12 Jan 2026</p>
                </CardContent>
              </Card>
            ))}

            {/* Upload Placeholder Card */}
            <div 
              className="border-2 border-dashed border-muted-foreground/20 rounded-xl aspect-video flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all group"
              onClick={handleUpload}
            >
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="text-sm font-bold text-muted-foreground group-hover:text-primary">Click to Upload</p>
              <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
