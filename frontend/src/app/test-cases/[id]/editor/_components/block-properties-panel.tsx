/**
 * Properties panel for the currently selected flow block.
 *
 * Displayed on the right side of the editor canvas.  Shows type-specific
 * fields (URL for Navigate, selector for Click, assertion config, etc.)
 * and common fields like label, description, and passing criteria.
 */

"use client";

import type { Node } from "@xyflow/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBlockConfig } from "./block-config";

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
export function BlockPropertiesPanel({ node, onUpdate, onDelete }: BlockPropertiesPanelProps) {
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
            <Input value={data.url || ""} onChange={(e) => update("url", e.target.value)} placeholder="/page or https://..." />
          </div>
        )}

        {(blockType === "click" || blockType === "type" || blockType === "select" || blockType === "hover" || blockType === "scroll") && (
          <div className="space-y-1.5">
            <Label className="text-xs">CSS Selector</Label>
            <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder='button.submit, #login-form, [data-testid="..."]' className="font-mono text-xs" />
          </div>
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
            <div className="space-y-1.5">
              <Label className="text-xs">CSS Selector</Label>
              <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder="Element to assert on" className="font-mono text-xs" />
            </div>
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
