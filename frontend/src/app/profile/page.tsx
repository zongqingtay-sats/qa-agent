"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { User, Save, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { usersApi } from "@/lib/api";
import type { UserProfile } from "@/types/api";
import Link from "next/link";

const PRESET_COLORS = [
  "#4f46e5", "#7c3aed", "#db2777", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0d9488",
  "#0284c7", "#475569", "#1e293b", "#6366f1",
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [avatarBg, setAvatarBg] = useState("#4f46e5");
  const [avatarText, setAvatarText] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await usersApi.getProfile();
      setProfile(res.data);
      setName(res.data.name || "");
      setAvatarBg(res.data.avatarBg || "#4f46e5");
      setAvatarText(res.data.avatarText || res.data.name?.[0]?.toUpperCase() || "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await usersApi.updateProfile({
        name: name.trim() || undefined,
        avatarBg: avatarBg || null,
        avatarText: avatarText.trim() || null,
      });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Profile" icon={<User className="h-5 w-5" />} />
        <div className="p-4 max-w-2xl space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile"
        icon={<User className="h-5 w-5" />}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 max-w-2xl space-y-6">
        {/* Avatar & Name */}
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{ backgroundColor: avatarBg }}
              >
                {avatarText || name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Avatar Preview</p>
                <p className="text-xs text-muted-foreground">Choose a background color and display text for your avatar.</p>
              </div>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Avatar text */}
            <div className="space-y-2">
              <Label htmlFor="avatar-text">Avatar Text</Label>
              <Input
                id="avatar-text"
                value={avatarText}
                onChange={(e) => setAvatarText(e.target.value.slice(0, 3))}
                placeholder="e.g. JD"
                maxLength={3}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">1–3 characters shown in your avatar circle.</p>
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <Button
                    key={color}
                    variant="ghost"
                    className={`h-8 w-8 rounded-full border-2 p-0 ${avatarBg === color ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setAvatarBg(color)}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-xs">Custom:</Label>
                <input
                  type="color"
                  id="custom-color"
                  value={avatarBg}
                  onChange={(e) => setAvatarBg(e.target.value)}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">{avatarBg}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info (read-only) */}
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{profile?.email || "—"}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Global Role</span>
              {profile?.globalRole ? (
                <Badge variant={profile.globalRole.isAdmin ? "default" : "secondary"}>
                  {profile.globalRole.name}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">None assigned</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Roles */}
        <Card>
          <CardHeader><CardTitle>Project Access &amp; Roles</CardTitle></CardHeader>
          <CardContent>
            {profile?.projectRoles && profile.projectRoles.length > 0 ? (
              <div className="divide-y">
                {profile.projectRoles.map((pr) => (
                  <div key={pr.projectId} className="flex items-center justify-between py-2">
                    <Link href={`/projects/${pr.projectId}`} className="flex items-center gap-2 text-sm font-medium hover:underline">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      {pr.projectName}
                    </Link>
                    <Badge variant="outline">
                      {pr.role ? pr.role.name : "Global role"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No project access granted yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
