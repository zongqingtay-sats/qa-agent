/**
 * Settings page.
 *
 * Allows the user to configure the browser extension ID, choose a
 * colour theme (light / dark / system), and view environment info.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plug, CheckCircle, XCircle, Loader2, Sun, Moon, Monitor, Settings } from "lucide-react";
import { toast } from "sonner";
import { getExtensionId, setExtensionId, pingExtension } from "@/lib/extension";
import { getTheme, setTheme, type Theme } from "@/lib/theme";

export default function SettingsPage() {
  const router = useRouter();
  const [extensionId, setExtensionIdState] = useState("");
  const [extensionStatus, setExtensionStatus] = useState<"unknown" | "checking" | "connected" | "disconnected">("unknown");
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const id = getExtensionId();
    setExtensionIdState(id);
    if (id) {
      checkExtension(id);
    }
    setThemeState(getTheme());
  }, []);

  async function checkExtension(id?: string) {
    const checkId = id || extensionId;
    if (!checkId) {
      setExtensionStatus("disconnected");
      return;
    }
    setExtensionStatus("checking");
    const ok = await pingExtension(checkId);
    setExtensionStatus(ok ? "connected" : "disconnected");
  }

  function handleSave() {
    setExtensionId(extensionId.trim());
    toast.success("Extension ID saved");
    if (extensionId.trim()) {
      checkExtension(extensionId.trim());
    }
  }

  return (
    <>
      <PageHeader title="Settings" icon={<Settings className="h-5 w-5" />} />
      <div className="flex-1 p-4 space-y-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Browser Extension
            </CardTitle>
            <CardDescription>
              Connect the QA Agent browser extension to enable test execution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extension-id">Extension ID</Label>
              <div className="flex gap-2">
                <Input
                  id="extension-id"
                  value={extensionId}
                  onChange={(e) => setExtensionIdState(e.target.value)}
                  placeholder="e.g. abcdefghijklmnopqrstuvwxyz"
                  className="font-mono text-sm"
                />
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
              <Button variant="outline" onClick={() => router.push("/setup")}>
                <Plug className="h-4 w-4 mr-2" />
                Open Extension Setup Guide
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {extensionStatus === "unknown" && (
                <Badge variant="secondary">Not checked</Badge>
              )}
              {extensionStatus === "checking" && (
                <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Checking...</Badge>
              )}
              {extensionStatus === "connected" && (
                <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>
              )}
              {extensionStatus === "disconnected" && (
                <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Not connected</Badge>
              )}
              <Button variant="outline" onClick={() => checkExtension()} disabled={!extensionId || extensionStatus === "checking"}>
                Test Connection
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={theme} onValueChange={(value) => {
              const t = value as Theme;
              setThemeState(t);
              setTheme(t);
            }}>
              <TabsList>
                <TabsTrigger value="light"><Sun className="h-4 w-4 mr-1" /> Light</TabsTrigger>
                <TabsTrigger value="dark"><Moon className="h-4 w-4 mr-1" /> Dark</TabsTrigger>
                <TabsTrigger value="system"><Monitor className="h-4 w-4 mr-1" /> System</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
