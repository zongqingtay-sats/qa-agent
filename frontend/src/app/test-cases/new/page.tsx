/**
 * Create new test case page.
 *
 * Accepts optional URL search params: projectId, featureId, phaseId.
 * Creates a blank test case with those values pre-assigned, then
 * redirects to the editor.
 */

"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { testCasesApi } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";

export default function NewTestCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const creating = useRef(false);

  useEffect(() => {
    if (creating.current) return;
    creating.current = true;

    const projectId = searchParams.get("projectId") || undefined;
    const featureId = searchParams.get("featureId") || undefined;
    const phaseId = searchParams.get("phaseId") || undefined;

    async function create() {
      try {
        const res = await testCasesApi.create({
          name: "New Test Case",
          description: "",
          flowData: {
            nodes: [
              { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
              { id: "navigate-1", type: "actionNode", position: { x: 250, y: 170 }, data: { label: "Navigate to URL", blockType: "navigate", url: "" } },
              { id: "end-1", type: "endNode", position: { x: 250, y: 290 }, data: { label: "End", blockType: "end" } },
            ],
            edges: [
              { id: "e-start-nav", source: "start-1", target: "navigate-1", animated: true },
              { id: "e-nav-end", source: "navigate-1", target: "end-1", animated: true },
            ],
          },
          projectId,
          featureIds: featureId ? [featureId] : undefined,
          phaseIds: phaseId ? [phaseId] : undefined,
        });
        router.replace(`/test-cases/${res.data.id}/editor`);
      } catch (err: any) {
        toast.error(err.message || "Failed to create test case");
        router.back();
      }
    }
    create();
  }, [router, searchParams]);

  return (
    <>
      <PageHeader title="Creating test case..." />
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Creating new test case...
      </div>
    </>
  );
}
