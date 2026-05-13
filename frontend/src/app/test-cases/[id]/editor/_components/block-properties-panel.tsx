/**
 * Properties panel for the currently selected flow block.
 *
 * Displayed on the right side of the editor canvas. Shows type-specific
 * fields (URL for Navigate, selector for Click, assertion config, etc.)
 * and common fields like label, description, and passing criteria.
 *
 * The CSS selector field with element-picker integration is provided by
 * the `SelectorField` component in a separate module.
 *
 * @param props.node     - The selected ReactFlow node.
 * @param props.onUpdate - Called with `(nodeId, newData)` on every field change.
 * @param props.onDelete - Called with `(nodeId)` when the delete button is clicked.
 */

"use client";

import { useState } from "react";
import type { Node } from "@xyflow/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { getBlockConfig } from "./block-config";
import { SelectorField } from "./selector-field";
import { formatUrl } from "@/app/generate/_lib/url-utils";
import type { BlockData } from "@/types/api";

interface BlockPropertiesPanelProps {
  node: Node | null;
  onUpdate: (id: string, data: BlockData & Record<string, unknown>) => void;
  onDelete: (id: string) => void;
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

  const data = node.data as BlockData & Record<string, unknown>;
  const blockType = data.blockType;

  /** Shorthand to update a single data field. */
  function update(field: string, value: string | number | boolean | null | undefined) {
    onUpdate(node!.id, { ...data, [field]: value });
  }

  return (
    <ScrollArea className="w-72 border-l bg-muted/30">
      <div className="p-4 space-y-4">
        {/* Header: block type icon and label */}
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

        {/* Common fields — every block has a label and description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={data.label || ""} onChange={(e) => update("label", e.target.value)} placeholder="Block label" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea value={data.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="What does this step do?" rows={2} />
        </div>

        <Separator />

        {/* ── Type-specific fields ── */}

        {/* Navigate: URL input */}
        {blockType === "navigate" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={data.url || ""} onChange={(e) => update("url", e.target.value)} onBlur={(e) => { const f = formatUrl(e.target.value); if (f !== e.target.value) update("url", f); }} placeholder="/page or https://..." />
          </div>
        )}

        {/* Click / Type / Select / Hover / Scroll: CSS selector */}
        {(blockType === "click" || blockType === "type" || blockType === "select" || blockType === "hover" || blockType === "scroll") && (
          <SelectorField value={data.selector || ""} onChange={(v) => update("selector", v)} picking={picking} setPicking={setPicking} placeholder='button.submit, #login-form, [data-testid="..."]' />
        )}

        {/* Click: click type dropdown */}
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

        {/* Type: text value */}
        {blockType === "type" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Text Value</Label>
            <Input value={data.value || ""} onChange={(e) => update("value", e.target.value)} placeholder="Text to type" />
          </div>
        )}

        {/* Select: option value */}
        {blockType === "select" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Option Value</Label>
            <Input value={data.selectValue || ""} onChange={(e) => update("selectValue", e.target.value)} placeholder="Option value or label" />
          </div>
        )}

        {/* Scroll: direction + distance */}
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

        {/* Wait: wait type + timeout */}
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

        {/* Assert: selector + assertion type + expected value */}
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

        {/* If-Else: condition selector + condition type */}
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
            {data.conditionType === "text-contains" || data.conditionType === "value-equals" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Expected Value</Label>
                <Input value={data.conditionValue || ""} onChange={(e) => update("conditionValue", e.target.value)} placeholder="Expected value" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
