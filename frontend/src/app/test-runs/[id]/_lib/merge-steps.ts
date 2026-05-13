/**
 * Merge executed step results with the expected step list derived from
 * the test case's flow data.
 *
 * Produces a unified array where every expected step appears (even if it
 * was never executed), and retry attempts are included as separate entries
 * so the UI can show a complete picture of what happened.
 */

import type { FlowData, FlowNode, FlowEdge, StepResult } from "@/types/api";

/** Shape of a single expected step derived from flow data via BFS. */
export interface ExpectedStep {
  blockId: string;
  blockType: string;
  description: string;
  target?: string;
}

/**
 * Parse `flowData` (from the test run's associated test case) and return
 * an ordered list of expected steps by walking the graph with BFS,
 * excluding Start and End nodes.
 *
 * @param flowData - The raw `flowData` field (string or object).
 * @returns Ordered array of expected steps, or `[]` if parsing fails.
 */
export function deriveExpectedSteps(flowData: string | FlowData): ExpectedStep[] {
  try {
    const flow: FlowData = typeof flowData === "string" ? JSON.parse(flowData) : flowData;
    if (!flow?.nodes || !flow?.edges) return [];

    const nodeMap = new Map(flow.nodes.map((n: FlowNode) => [n.id, n]));
    const adjacency = new Map<string, string[]>();
    flow.edges.forEach((e: FlowEdge) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    });

    const startNode = flow.nodes.find((n: FlowNode) => n.data?.blockType === "start");
    if (!startNode) return [];

    const steps: ExpectedStep[] = [];
    const visited = new Set<string>();
    const queue = [startNode.id];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeMap.get(id) as FlowNode | undefined;
      if (node) {
        const d = node.data || {};
        if (d.blockType !== "start" && d.blockType !== "end") {
          steps.push({
            blockId: node.id,
            blockType: d.blockType,
            description: d.label || d.description || d.blockType,
            target: d.selector || d.url,
          });
        }
      }
      (adjacency.get(id) || []).forEach((t: string) => {
        if (!visited.has(t)) queue.push(t);
      });
    }

    return steps;
  } catch {
    return [];
  }
}

/**
 * Merge executed step results with expected steps to produce a unified
 * list suitable for the step-results table.
 *
 * - For each expected step, matching executed results are attached.
 * - Unexecuted expected steps are included with `_unexecuted: true`.
 * - Retry steps (same blockId, `retry: true`) are separate entries.
 * - Any executed steps that don't match an expected step are appended
 *   at the end (edge case safety).
 *
 * @param executedSteps  - The `stepResults` array from the test run.
 * @param expectedSteps  - Ordered expected steps from `deriveExpectedSteps`.
 * @returns A merged array combining both sources.
 */
export function mergeSteps(executedSteps: StepResult[], expectedSteps: ExpectedStep[]): (StepResult & { _unexecuted?: boolean })[] {
  if (expectedSteps.length === 0) return executedSteps;

  const merged: (StepResult & { _unexecuted?: boolean })[] = [];
  const usedIds = new Set<string>();

  expectedSteps.forEach((expected, idx) => {
    const stepOrder = idx + 1;

    // Find all executed results for this step (including retries)
    const matches = executedSteps.filter(
      (s) => s.blockId === expected.blockId || (!s.blockId && s.stepOrder === stepOrder)
    );

    if (matches.length === 0) {
      // Unexecuted step — show as placeholder
      merged.push({
        stepOrder,
        blockId: expected.blockId,
        blockType: expected.blockType,
        description: expected.description,
        target: expected.target,
        status: "skipped",
        _unexecuted: true,
      } as StepResult & { _unexecuted: true });
    } else {
      matches.forEach((m) => {
        usedIds.add(m.id || `${m.stepOrder}-${m.retry}`);
        merged.push({ ...m, stepOrder: m.stepOrder || stepOrder });
      });
    }
  });

  // Append orphan executed steps that didn't match any expected step
  executedSteps.forEach((s) => {
    const id = s.id || `${s.stepOrder}-${s.retry}`;
    if (!usedIds.has(id)) merged.push(s);
  });

  return merged;
}
