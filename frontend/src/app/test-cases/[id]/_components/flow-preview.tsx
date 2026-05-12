"use client";

import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBlockConfig } from "../editor/_components/block-config";
import type { FlowNode, FlowEdge } from "@/lib/store";

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface FlowPreviewProps {
  testCaseId: string;
  flowData: FlowData | string | null | undefined;
}

/** Walk edges from the start node to produce an ordered list of node ids. */
function getOrderedNodeIds(flowData: FlowData): string[] {
  const edgeMap = new Map<string, string>();
  for (const edge of flowData.edges) {
    // Use default source handle; for if-else we just pick the first
    if (!edgeMap.has(edge.source)) {
      edgeMap.set(edge.source, edge.target);
    }
  }

  const startNode = flowData.nodes.find((n) => n.data.blockType === "start");
  if (!startNode) return flowData.nodes.map((n) => n.id);

  const ordered: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = startNode.id;
  while (current && !visited.has(current)) {
    visited.add(current);
    ordered.push(current);
    current = edgeMap.get(current);
  }
  return ordered;
}

export function FlowPreview({ testCaseId, flowData: rawFlowData }: FlowPreviewProps) {
  const flowData: FlowData | null = (() => {
    if (!rawFlowData) return null;
    if (typeof rawFlowData === "string") {
      try { return JSON.parse(rawFlowData); } catch { return null; }
    }
    return rawFlowData;
  })();

  if (!flowData?.nodes?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No flow defined yet</p>
        </CardContent>
      </Card>
    );
  }

  const nodeMap = new Map(flowData.nodes.map((n) => [n.id, n]));
  const orderedIds = getOrderedNodeIds(flowData);
  const orderedNodes = orderedIds
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as FlowData["nodes"];

  return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Test Flow
            <Button variant="ghost" size="icon" className="h-7 w-7" nativeButton={false} render={<Link href={`/test-cases/${testCaseId}/editor`} />}>
              <Pencil className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {orderedNodes.map((node, i) => {
              const config = getBlockConfig(node.data.blockType);
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div key={node.id} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  )}
                  <div
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${config.color}`}
                    title={node.data.description || node.data.label}
                  >
                    <Icon className="h-3 w-3" />
                    {node.data.label}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
  );
}
