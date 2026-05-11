/**
 * Draggable block palette shown on the left side of the flow editor.
 *
 * Users drag blocks from this panel onto the ReactFlow canvas to add
 * new steps to the test flow.  Blocks are grouped by category.
 */

"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { BLOCK_TYPES } from "./block-config";

/**
 * Handles the HTML5 drag-start event by attaching the block type as
 * transfer data so the canvas `onDrop` handler can read it.
 */
function onDragStart(event: React.DragEvent, blockType: string) {
  event.dataTransfer.setData("application/reactflow-blocktype", blockType);
  event.dataTransfer.effectAllowed = "move";
}

/** Ordered list of palette section headings. */
const CATEGORIES = ["Control", "Action", "Validation", "Capture"] as const;

/**
 * Sidebar palette listing every available block type, grouped by category.
 *
 * Each block is a draggable element that can be dropped onto the ReactFlow
 * canvas.
 */
export function BlockPalette() {
  return (
    <ScrollArea className="w-56 border-r bg-muted/30">
      <div className="p-3 space-y-4">
        <h3 className="font-semibold text-sm px-1">Block Palette</h3>
        {CATEGORIES.map((category) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground font-medium px-1 mb-2">{category}</p>
            <div className="space-y-1.5">
              {BLOCK_TYPES.filter((b) => b.category === category).map((block) => {
                const Icon = block.icon;
                return (
                  <div
                    key={block.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, block.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab active:cursor-grabbing text-sm ${block.color} hover:opacity-80 transition-opacity`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{block.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
