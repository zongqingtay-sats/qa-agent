/**
 * Custom ReactFlow node component used by every block type in the editor.
 *
 * It renders the block's icon, label, description, selector, and the
 * appropriate source/target handles based on block type (Start, End,
 * If-Else, or generic action).
 */

"use client";

import { Handle, Position, type NodeTypes } from "@xyflow/react";
import { getBlockConfig } from "./block-config";

/**
 * Generic flow-block node renderer.
 *
 * @param data     - The node's `data` payload containing `blockType`, `label`,
 *                   `description`, `selector`, and `executionStatus`.
 * @param selected - Whether the node is currently selected in the canvas.
 */
export function FlowBlockNode({ data, selected }: { data: any; selected: boolean }) {
  const config = getBlockConfig(data.blockType);
  if (!config) return null;

  const Icon = config.icon;

  // Highlight based on live execution feedback from the extension
  const executionStatusClass =
    data.executionStatus === "passed"
      ? "ring-2 ring-green-500"
      : data.executionStatus === "failed"
        ? "ring-2 ring-red-500"
        : data.executionStatus === "running"
          ? "ring-2 ring-blue-500 animate-pulse"
          : "";

  const isStart = data.blockType === "start";
  const isEnd = data.blockType === "end";

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 min-w-[160px] shadow-sm ${config.color} ${selected ? "ring-2 ring-primary" : ""} ${executionStatusClass} relative`}
    >
      {/* Target handle (top) — all blocks except Start */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{data.label || config.label}</span>
      </div>
      {data.description && (
        <p className="text-xs mt-1 opacity-70 truncate">{data.description}</p>
      )}
      {data.selector && (
        <p className="text-xs mt-1 font-mono opacity-60 truncate">{data.selector}</p>
      )}

      {/* Source handle (bottom) — all blocks except End and If-Else */}
      {!isEnd && data.blockType !== "if-else" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white"
        />
      )}

      {/* If-Else: two labelled source handles for then/else branches */}
      {data.blockType === "if-else" && (
        <>
          <div className="flex justify-between mt-2 text-[10px] font-semibold">
            <span className="text-green-700">Then</span>
            <span className="text-red-700">Else</span>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="then"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
            style={{ left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="else"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
            style={{ left: "70%" }}
          />
        </>
      )}
    </div>
  );
}

/**
 * Map of ReactFlow node type keys → component.
 *
 * Every custom node type resolves to the same `FlowBlockNode` renderer;
 * the visual differences come from the `data.blockType` field.
 */
export const nodeTypes: NodeTypes = {
  startNode: FlowBlockNode,
  endNode: FlowBlockNode,
  actionNode: FlowBlockNode,
  assertNode: FlowBlockNode,
  conditionNode: FlowBlockNode,
  captureNode: FlowBlockNode,
};
