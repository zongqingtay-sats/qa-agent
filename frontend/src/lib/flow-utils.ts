/**
 * Shared utilities for building ReactFlow graph data from step arrays.
 *
 * Used by both the flow editor (when refining via AI) and the generate page
 * (when saving generated test cases). Centralising this logic prevents
 * divergence between the two code paths.
 */

import type { Node, Edge } from "@xyflow/react";

/** Maps a block type string to its corresponding ReactFlow node type. */
function blockTypeToNodeType(blockType: string): string {
  switch (blockType) {
    case "start":
      return "startNode";
    case "end":
      return "endNode";
    case "assert":
      return "assertNode";
    case "if-else":
      return "conditionNode";
    case "screenshot":
      return "captureNode";
    default:
      return "actionNode";
  }
}

/**
 * Describes a single test step as returned by the AI generation endpoints.
 */
export interface GeneratedStep {
  action: string;
  target?: string;
  value?: string;
  description?: string;
  order?: number;
}

/**
 * Build a complete ReactFlow graph (nodes + edges) from a flat list of
 * generated steps.  A "Start" node is prepended and an "End" node is
 * appended automatically.
 *
 * @param steps - Ordered list of AI-generated step objects.
 * @returns An object containing `nodes` and `edges` arrays compatible
 *          with ReactFlow and the backend `flowData` schema.
 */
export function buildFlowFromSteps(steps: GeneratedStep[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [
    {
      id: "start-1",
      type: "startNode",
      position: { x: 250, y: 0 },
      data: { label: "Start", blockType: "start" },
    },
  ];
  const edges: Edge[] = [];

  steps.forEach((step, i) => {
    const nodeId = `step-${i + 1}`;
    const blockType = step.action || "click";

    nodes.push({
      id: nodeId,
      type: blockTypeToNodeType(blockType),
      position: { x: 250, y: (i + 1) * 120 },
      data: {
        label: step.description || step.action,
        blockType,
        selector: blockType === "navigate" ? undefined : step.target,
        url: blockType === "navigate" ? step.target : undefined,
        value: step.value,
        expectedValue: blockType === "assert" ? step.value : undefined,
        description: step.description,
      },
    });

    // Chain each node to the previous one
    edges.push({
      id: `e-${i === 0 ? "start-1" : `step-${i}`}-${nodeId}`,
      source: i === 0 ? "start-1" : `step-${i}`,
      target: nodeId,
      animated: true,
    });
  });

  // Append the "End" node and connect it
  const endId = "end-1";
  nodes.push({
    id: endId,
    type: "endNode",
    position: { x: 250, y: nodes.length * 120 },
    data: { label: "End", blockType: "end" },
  });

  if (steps.length > 0) {
    edges.push({
      id: `e-step-${steps.length}-${endId}`,
      source: `step-${steps.length}`,
      target: endId,
      animated: true,
    });
  }

  return { nodes, edges };
}
