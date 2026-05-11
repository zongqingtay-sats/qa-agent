/**
 * Flow validation logic for the test-case editor.
 *
 * Checks structural rules (exactly one Start, at least one End, Navigate
 * after Start, connectivity, required fields) and returns categorised
 * errors and warnings.
 */

import type { Node, Edge } from "@xyflow/react";

export interface ValidationResult {
  /** `true` when there are zero errors (warnings are acceptable). */
  valid: boolean;
  /** Hard errors that prevent the flow from running. */
  errors: string[];
  /** Soft warnings that don't block execution but indicate issues. */
  warnings: string[];
}

/**
 * Validate a flow graph against the structural rules required to execute
 * a test via the browser extension.
 *
 * Rules enforced:
 *  1. Exactly one Start block.
 *  2. At least one End block.
 *  3. The first block after Start must be a Navigate block.
 *  4. At least one Assert block.
 *  5. All blocks must be reachable from Start (warning if not).
 *  6. Action blocks must have a CSS selector.
 *  7. Navigate blocks must have a URL.
 *  8. If-Else blocks must have a condition and outgoing branches.
 *
 * @param nodes - The ReactFlow node array.
 * @param edges - The ReactFlow edge array.
 * @returns A `ValidationResult` with `valid`, `errors`, and `warnings`.
 */
export function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startNodes = nodes.filter((n) => (n.data as any).blockType === "start");
  const endNodes = nodes.filter((n) => (n.data as any).blockType === "end");

  if (startNodes.length === 0) errors.push("Flow must have a Start block");
  if (startNodes.length > 1) errors.push("Flow must have exactly one Start block");
  if (endNodes.length === 0) errors.push("Flow must have at least one End block");

  // Rule 3 — Navigate must follow Start
  if (startNodes.length === 1) {
    const startEdges = edges.filter((e) => e.source === startNodes[0].id);
    if (startEdges.length === 0) {
      errors.push("Start block must be connected to a Navigate block");
    } else {
      const firstTarget = nodes.find((n) => n.id === startEdges[0].target);
      if (!firstTarget || (firstTarget.data as any).blockType !== "navigate") {
        errors.push("The first block after Start must be a Navigate block");
      }
    }
  }

  // Rule 4 — at least one assert
  if (nodes.filter((n) => (n.data as any).blockType === "assert").length === 0) {
    errors.push("Flow must have at least one Assert block");
  }

  // Rule 5 — connectivity (BFS from Start)
  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      edges.filter((e) => e.source === current).forEach((e) => queue.push(e.target));
    }

    const unreachable = nodes.filter((n) => !reachable.has(n.id));
    if (unreachable.length > 0) {
      warnings.push(`${unreachable.length} block(s) are not reachable from Start`);
    }
  }

  // Rules 6–8 — per-node field checks
  nodes.forEach((n) => {
    const d = n.data as any;
    if (["click", "type", "select", "hover"].includes(d.blockType) && !d.selector) {
      errors.push(`${d.label || d.blockType} block is missing a CSS selector`);
    }
    if (d.blockType === "navigate" && !d.url) {
      errors.push(`${d.label || "Navigate"} block is missing a URL`);
    }
    if (d.blockType === "if-else") {
      if (!d.selector) {
        errors.push(`${d.label || "If-Else"} block is missing a condition selector`);
      }
      const outgoing = edges.filter((e) => e.source === n.id);
      if (outgoing.length < 2) {
        errors.push(`${d.label || "If-Else"} block must have at least 1 outgoing branches (then or else)`);
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
