/**
 * CSS selector input field with an integrated element picker dialog.
 *
 * Shows a textarea for manual selector editing alongside a "pick element"
 * button that opens a dialog listing open browser tabs.  The user can
 * select an existing tab or enter a URL, then interactively pick an
 * element on the page — the captured CSS selector fills the textarea.
 *
 * @param props.value       - Current CSS selector value.
 * @param props.onChange     - Called with the new selector string.
 * @param props.picking      - Whether the element picker is active.
 * @param props.setPicking   - Setter for the picking flag.
 * @param props.placeholder  - Optional placeholder text for the textarea.
 */

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crosshair, Loader2, ExternalLink, Globe } from "lucide-react";
import { formatUrl } from "@/app/generate/_lib/url-utils";
import {
  getExtensionId,
  pickElementViaExtension,
  listTabsViaExtension,
  openTabViaExtension,
  type BrowserTab,
} from "@/lib/extension";
import { toast } from "sonner";

interface SelectorFieldProps {
  value: string;
  onChange: (v: string) => void;
  picking: boolean;
  setPicking: (v: boolean) => void;
  placeholder?: string;
}

export function SelectorField({
  value, onChange, picking, setPicking, placeholder,
}: SelectorFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);

  /** Open the tab-picker dialog and fetch available browser tabs. */
  async function openPicker() {
    const extId = getExtensionId();
    if (!extId) {
      toast.error("Connect the browser extension first (Settings page)");
      return;
    }
    setDialogOpen(true);
    setLoadingTabs(true);
    setManualUrl("");
    setSelectedTabId(null);
    try {
      const result = await listTabsViaExtension(extId);
      if (result.error) toast.error(result.error);
      setTabs(result.tabs);
    } finally {
      setLoadingTabs(false);
    }
  }

  /** Navigate to the chosen tab (or open a new one) then start picking. */
  async function handleGo() {
    const extId = getExtensionId();
    if (!extId) return;

    setDialogOpen(false);
    setPicking(true);

    try {
      let tabId = selectedTabId ?? undefined;

      // If user typed a manual URL, open a new tab for it
      if (manualUrl.trim()) {
        const url = formatUrl(manualUrl);
        const res = await openTabViaExtension(extId, url);
        if (res.error) { toast.error(res.error); return; }
        tabId = res.tabId;
      }

      const result = await pickElementViaExtension(extId, tabId);
      if (result.error) toast.error(result.error);
      else if (result.selector) { onChange(result.selector); toast.success("Selector captured"); }
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">CSS Selector</Label>
      <div className="flex gap-1 items-start">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs flex-1 min-h-9 resize-y"
          rows={1}
        />
        <Button
          variant="outline" size="icon"
          className="shrink-0 h-9 w-9 mt-0"
          disabled={picking}
          title="Pick element from page"
          onClick={openPicker}
        >
          {picking
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Crosshair className="h-4 w-4" />}
        </Button>
      </div>

      {/* Tab picker dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="min-w-1/2">
          <DialogHeader>
            <DialogTitle>Select Target Page</DialogTitle>
          </DialogHeader>

          {/* Tab list */}
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {loadingTabs ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading tabs…
              </div>
            ) : tabs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No browser tabs found.</p>
            ) : (
              tabs.map((tab) => (
                <button
                  key={tab.id} type="button"
                  onClick={() => { setSelectedTabId(tab.id); setManualUrl(""); }}
                  className={`cursor-pointer w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    selectedTabId === tab.id ? "bg-accent" : ""
                  }`}
                >
                  {tab.favIconUrl
                    ? <img src={tab.favIconUrl} alt="" className="h-4 w-4 shrink-0" />
                    : <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tab.title || "Untitled"}</p>
                    <p className="truncate text-xs text-muted-foreground">{tab.url}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <Separator />

          {/* Manual URL input */}
          <div className="space-y-1.5">
            <Label className="text-xs">Or enter a URL</Label>
            <Input
              value={manualUrl}
              onChange={(e) => { setManualUrl(e.target.value); setSelectedTabId(null); }}
              placeholder="https://example.com"
            />
          </div>

          <Button
            className="w-full"
            disabled={!selectedTabId && !manualUrl.trim()}
            onClick={handleGo}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {manualUrl.trim() ? "Open & Pick Element" : "Go to Tab & Pick Element"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
