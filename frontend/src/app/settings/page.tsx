"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Plug, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getExtensionId, setExtensionId, pingExtension } from "@/lib/extension";

export default function SettingsPage() {
  const [extensionId, setExtensionIdState] = useState("");
  const [extensionStatus, setExtensionStatus] = useState<"unknown" | "checking" | "connected" | "disconnected">("unknown");

  useEffect(() => {
    const id = getExtensionId();
    setExtensionIdState(id);
    if (id) {
      checkExtension(id);
    }
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
      <PageHeader title="Settings" description="Configure the QA Agent application" />
      <div className="flex-1 p-6 space-y-6 max-w-2xl">
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
                <Button onClick={handleSave} size="sm">
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Find your extension ID at <code>chrome://extensions</code> or <code>edge://extensions</code> after loading the unpacked extension.
              </p>
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
              <Button variant="outline" size="sm" onClick={() => checkExtension()} disabled={!extensionId || extensionStatus === "checking"}>
                Test Connection
              </Button>
            </div>

            <div className="rounded-md border p-4 bg-muted/30 space-y-2">
              <p className="text-sm font-medium">Setup Instructions</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Open <code>chrome://extensions</code> or <code>edge://extensions</code></li>
                <li>Enable <strong>Developer mode</strong> (top-right toggle)</li>
                <li>Click <strong>Load unpacked</strong> and select the <code>extension/</code> folder</li>
                <li>Copy the <strong>Extension ID</strong> shown under the extension name</li>
                <li>Paste it in the field above and click Save</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
