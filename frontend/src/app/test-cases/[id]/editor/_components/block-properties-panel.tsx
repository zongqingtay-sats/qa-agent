/**
 * Properties panel for the currently selected flow block.
 *
 * Displayed on the right side of the editor canvas.  Shows type-specific
 * fields (URL for Navigate, selector for Click, assertion config, etc.)
 * and common fields like label, description, and passing criteria.
 */

"use client";

import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crosshair, Loader2, ExternalLink, Globe } from "lucide-react";
import { getBlockConfig } from "./block-config";
import { formatUrl } from "@/app/generate/_lib/url-utils";
import {
  getExtensionId,
  pickElementViaExtension,
  listTabsViaExtension,
  openTabViaExtension,
  type BrowserTab,
} from "@/lib/extension";
import { toast } from "sonner";

interface BlockPropertiesPanelProps {
  /** The currently selected node, or `null` when nothing is selected. */
  node: Node | null;
  /** Callback to update a node's data by id. */
  onUpdate: (id: string, data: any) => void;
  /** Callback to delete a node by id. */
  onDelete: (id: string) => void;
}

/**
 * Renders an editable property form for the selected flow block.
 *
 * When no block is selected a placeholder message is shown instead.
 *
 * @param props.node     - The selected ReactFlow node.
 * @param props.onUpdate - Called with `(nodeId, newData)` on every field change.
 * @param props.onDelete - Called with `(nodeId)` when the delete button is clicked.
 */

/** Reusable CSS selector field with textarea + element picker dialog. */
function SelectorField({ value, onChange, picking, setPicking, placeholder }: {
  value: string; onChange: (v: string) => void;
  picking: boolean; setPicking: (v: boolean) => void;
  placeholder?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null);

  /** Open the dialog and fetch available tabs. */
  async function openPicker() {
    const extId = getExtensionId();
    if (!extId) { toast.error("Connect the browser extension first (Settings page)"); return; }
    setDialogOpen(true);
    setLoadingTabs(true);
    setManualUrl("");
    setSelectedTabId(null);
    try {
      const result = await listTabsViaExtension(extId);
      if (result.error) toast.error(result.error);
      setTabs(result.tabs);
    } finally { setLoadingTabs(false); }
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
      if (result.error) { toast.error(result.error); }
      else if (result.selector) { onChange(result.selector); toast.success("Selector captured"); }
    } finally { setPicking(false); }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">CSS Selector</Label>
      <div className="flex gap-1 items-start">
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-xs flex-1 min-h-9 resize-y" rows={1} />
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9 mt-0"
          disabled={picking}
          title="Pick element from page"
          onClick={openPicker}
        >
          {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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
                  key={tab.id}
                  type="button"
                  onClick={() => { setSelectedTabId(tab.id); setManualUrl(""); }}
                  className={`cursor-pointer w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    selectedTabId === tab.id ? "bg-accent" : ""
                  }`}
                >
                  {tab.favIconUrl ? (
                    <img src={tab.favIconUrl} alt="" className="h-4 w-4 shrink-0" />
                  ) : (
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{tab.title || "Untitled"}</p>
                    <p className="truncate text-xs text-muted-foreground">{tab.url}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <Separator />

          {/* Manual URL */}
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

export function BlockPropertiesPanel({ node, onUpdate, onDelete }: BlockPropertiesPanelProps) {
  const [picking, setPicking] = useState(false);

  if (!node) {
    return (
      <div className="w-72 border-l bg-muted/30 p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">Select a block to edit its properties</p>
      </div>
    );
  }

  const data = node.data as any;
  const blockType = data.blockType;

  /** Shorthand to update a single data field. */
  function update(field: string, value: any) {
    onUpdate(node!.id, { ...data, [field]: value });
  }

  return (
    <ScrollArea className="w-72 border-l bg-muted/30">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {(() => {
              const config = getBlockConfig(blockType);
              if (!config) return null;
              const Icon = config.icon;
              return <Icon className="h-4 w-4" />;
            })()}
            {getBlockConfig(blockType)?.label || blockType} Block
          </h3>
          <Badge variant="outline" className="mt-1">{blockType}</Badge>
        </div>

        <Separator />

        {/* Common: Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={data.label || ""} onChange={(e) => update("label", e.target.value)} placeholder="Block label" />
        </div>

        {/* Common: Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea value={data.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="What does this step do?" rows={2} />
        </div>

        <Separator />

        {/* ── Type-specific fields ── */}

        {blockType === "navigate" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={data.url || ""} onChange={(e) => update("url", e.target.value)} onBlur={(e) => { const f = formatUrl(e.target.value); if (f !== e.target.value) update("url", f); }} placeholder="/page or https://..." />
          </div>
        )}

        {(blockType === "click" || blockType === "type" || blockType === "select" || blockType === "hover" || blockType === "scroll") && (
          <SelectorField value={data.selector || ""} onChange={(v) => update("selector", v)} picking={picking} setPicking={setPicking} placeholder='button.submit, #login-form, [data-testid="..."]' />
        )}

        {blockType === "click" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Click Type</Label>
            <Select value={data.clickType || "single"} onValueChange={(v) => update("clickType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Click</SelectItem>
                <SelectItem value="double">Double Click</SelectItem>
                <SelectItem value="right">Right Click</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {blockType === "type" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Text Value</Label>
            <Input value={data.value || ""} onChange={(e) => update("value", e.target.value)} placeholder="Text to type" />
          </div>
        )}

        {blockType === "select" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Option Value</Label>
            <Input value={data.selectValue || ""} onChange={(e) => update("selectValue", e.target.value)} placeholder="Option value or label" />
          </div>
        )}

        {blockType === "scroll" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <Select value={data.scrollDirection || "down"} onValueChange={(v) => update("scrollDirection", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (px)</Label>
              <Input type="number" value={data.scrollDistance || 300} onChange={(e) => update("scrollDistance", Number(e.target.value))} />
            </div>
          </>
        )}

        {blockType === "wait" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Wait Type</Label>
              <Select value={data.waitType || "time"} onValueChange={(v) => update("waitType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Fixed Time</SelectItem>
                  <SelectItem value="element-visible">Element Visible</SelectItem>
                  <SelectItem value="element-hidden">Element Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(data.waitType === "element-visible" || data.waitType === "element-hidden") && (
              <div className="space-y-1.5">
                <Label className="text-xs">CSS Selector</Label>
                <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder="Element selector" className="font-mono text-xs" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout (ms)</Label>
              <Input type="number" value={data.timeout || 3000} onChange={(e) => update("timeout", Number(e.target.value))} />
            </div>
          </>
        )}

        {blockType === "assert" && (
          <>
            <SelectorField value={data.selector || ""} onChange={(v) => update("selector", v)} picking={picking} setPicking={setPicking} placeholder="Element to assert on" />
            <div className="space-y-1.5">
              <Label className="text-xs">Assertion Type</Label>
              <Select value={data.assertionType || "element-exists"} onValueChange={(v) => update("assertionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="element-exists">Element Exists</SelectItem>
                  <SelectItem value="element-not-exists">Element Not Exists</SelectItem>
                  <SelectItem value="element-visible">Element Visible</SelectItem>
                  <SelectItem value="text-contains">Text Contains</SelectItem>
                  <SelectItem value="value-equals">Value Equals</SelectItem>
                  <SelectItem value="url-matches">URL Matches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expected Value</Label>
              <Input value={data.expectedValue || ""} onChange={(e) => update("expectedValue", e.target.value)} placeholder="Expected value" />
            </div>
          </>
        )}

        {blockType === "if-else" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Selector</Label>
              <Input value={data.conditionSelector || ""} onChange={(e) => update("conditionSelector", e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Type</Label>
              <Select value={data.conditionType || "element-exists"} onValueChange={(v) => update("conditionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="element-exists">Element Exists</SelectItem>
                  <SelectItem value="text-contains">Text Contains</SelectItem>
                  <SelectItem value="value-equals">Value Equals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Value</Label>
              <Input value={data.conditionValue || ""} onChange={(e) => update("conditionValue", e.target.value)} />
            </div>
          </>
        )}

        {blockType === "screenshot" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Screenshot Label</Label>
            <Input value={data.screenshotLabel || ""} onChange={(e) => update("screenshotLabel", e.target.value)} placeholder="Label for this screenshot" />
          </div>
        )}

        {/* Common: Passing Criteria (all blocks except start/end) */}
        {blockType !== "start" && blockType !== "end" && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">Passing Criteria</Label>
              <Textarea value={data.passingCriteria || ""} onChange={(e) => update("passingCriteria", e.target.value)} placeholder="What determines if this step passes?" rows={2} />
            </div>
          </>
        )}

        <Separator />
        {blockType !== "start" && (
          <Button variant="destructive" className="w-full" onClick={() => onDelete(node.id)}>
            Delete Block
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
