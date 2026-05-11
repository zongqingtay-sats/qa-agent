/**
 * Custom hook encapsulating all state, data loading, and mutation handlers
 * for the visual flow editor.
 *
 * Extracted from the editor page to keep the page component focused on
 * layout and rendering while this hook owns the business logic.
 *
 * @param testCaseId - The ID of the test case being edited.
 */

"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnConnect,
  type Node,
  type Edge,
} from "@xyflow/react";
import { toast } from "sonner";

import { testCasesApi, exportApi, generateApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";
import { buildFlowFromSteps } from "@/lib/flow-utils";
import { blockTypeToNodeType, getBlockConfig } from "../_components/block-config";
import { validateFlow } from "../_lib/flow-validation";

/** Auto-incrementing counter for generating unique node IDs. */
let nodeIdCounter = 0;

export function useFlowEditor(testCaseId: string) {
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // ── Flow graph state ──
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // ── Test case metadata ──
  const [testCaseName, setTestCaseName] = useState("New Test Case");
  const [testCaseDescription, setTestCaseDescription] = useState("");
  const [testCasePreconditions, setTestCasePreconditions] = useState("");
  const [testCasePassingCriteria, setTestCasePassingCriteria] = useState("");
  const [testCaseTags, setTestCaseTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  // ── UI flags ──
  const [showMetadata, setShowMetadata] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /** Snapshot taken immediately after load so we can detect unsaved changes. */
  const initialSnapshot = useRef<string>("");

  // ── Load test case on mount ──
  useEffect(() => {
    async function load() {
      try {
        const res = await testCasesApi.get(testCaseId);
        const tc = res.data;
        setTestCaseName(tc.name);
        setTestCaseDescription(tc.description || "");
        setTestCasePreconditions(tc.preconditions || "");
        setTestCasePassingCriteria(tc.passingCriteria || "");
        setTestCaseTags(tc.tags || []);
        setTagsInput((tc.tags || []).join(", "));

        let flowData;
        try {
          flowData = typeof tc.flowData === "string" ? JSON.parse(tc.flowData) : tc.flowData;
        } catch {
          flowData = { nodes: [], edges: [] };
        }

        if (flowData.nodes?.length > 0) {
          setNodes(
            flowData.nodes.map((n: any) => ({
              ...n,
              type: n.type || blockTypeToNodeType(n.data?.blockType || "actionNode"),
            }))
          );
          nodeIdCounter = flowData.nodes.length + 1;
        }
        if (flowData.edges?.length > 0) {
          setEdges(flowData.edges);
        }
      } catch {
        // New test case — default placeholder flow
        setNodes([
          { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
          { id: "navigate-1", type: "actionNode", position: { x: 250, y: 170 }, data: { label: "Navigate to URL", blockType: "navigate", url: "" } },
          { id: "assert-1", type: "assertNode", position: { x: 250, y: 290 }, data: { label: "Assert", blockType: "assert", assertionType: "element-exists" } },
          { id: "end-1", type: "endNode", position: { x: 250, y: 410 }, data: { label: "End", blockType: "end" } },
        ]);
        setEdges([
          { id: "e-start-nav", source: "start-1", target: "navigate-1", animated: true },
          { id: "e-assert-end", source: "assert-1", target: "end-1", animated: true },
        ]);
        nodeIdCounter = 4;
      }
      setLoaded(true);
    }
    load();
  }, [testCaseId]);

  // Capture initial snapshot once loaded (for dirty-checking)
  useEffect(() => {
    if (loaded && !initialSnapshot.current) {
      initialSnapshot.current = JSON.stringify({
        testCaseName, testCaseDescription, testCasePreconditions,
        testCasePassingCriteria, testCaseTags, nodes, edges,
      });
    }
  }, [loaded, testCaseName, testCaseDescription, testCasePreconditions, testCasePassingCriteria, testCaseTags, nodes, edges]);

  const currentSnapshot = JSON.stringify({
    testCaseName, testCaseDescription, testCasePreconditions,
    testCasePassingCriteria, testCaseTags, nodes, edges,
  });
  const hasChanges = loaded && initialSnapshot.current !== "" && currentSnapshot !== initialSnapshot.current;

  // ── ReactFlow event handlers ──

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /** Handle block drops from the palette onto the canvas. */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("application/reactflow-blocktype");
      if (!blockType) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const config = getBlockConfig(blockType);

      const newNode: Node = {
        id: `${blockType}-${++nodeIdCounter}`,
        type: blockTypeToNodeType(blockType),
        position,
        data: { label: config?.label || blockType, blockType },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  // ── Node mutation helpers ──

  /** Replace a node's data payload. */
  function updateNodeData(id: string, data: any) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
    if (selectedNode?.id === id) {
      setSelectedNode((prev) => (prev ? { ...prev, data } : null));
    }
  }

  /** Remove a node and all its connected edges. */
  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  // ── Action handlers ──

  /** Persist the current flow and metadata to the backend. */
  async function handleSave() {
    setSaving(true);
    try {
      const validation = validateFlow(nodes, edges);
      const status = validation.valid ? "active" : "draft";
      await testCasesApi.update(testCaseId, {
        name: testCaseName, description: testCaseDescription,
        preconditions: testCasePreconditions, passingCriteria: testCasePassingCriteria,
        tags: testCaseTags, flowData: { nodes, edges }, status,
      });
      toast.success("Test case saved");
      initialSnapshot.current = currentSnapshot;
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /** Run validation and surface errors/warnings as toasts. */
  function handleValidate() {
    const result = validateFlow(nodes, edges);
    if (result.valid && result.warnings.length === 0) {
      toast.success("Flow is valid!");
    } else {
      result.errors.forEach((e) => toast.error(e));
      result.warnings.forEach((w) => toast.warning(w));
    }
  }

  /**
   * Send the current flow to the AI refinement endpoint.
   *
   * Scrapes navigate-target pages for DOM context so the AI can produce
   * more accurate selectors and assertions.
   */
  async function handleRefine() {
    setRefining(true);
    try {
      const startNode = nodes.find((n) => n.data?.blockType === "start");
      const baseUrl = (startNode?.data as any)?.baseUrl || "";
      const stepNodes = nodes.filter(
        (n) => n.data?.blockType && n.data.blockType !== "start" && n.data.blockType !== "end"
      );

      const steps = stepNodes.map((n, i) => ({
        order: i + 1,
        action: (n.data as any).blockType,
        target: (n.data as any).selector || (n.data as any).url,
        value: (n.data as any).value || (n.data as any).expectedValue,
        description: (n.data as any).description || (n.data as any).label,
      }));

      const testCases = [{ name: testCaseName, description: testCaseDescription, steps }];

      // Scrape pages for context
      const extensionId = getExtensionId();
      const pageContexts: { url: string; html: string }[] = [];

      if (extensionId) {
        const urls = new Set<string>();
        if (baseUrl) urls.add(baseUrl);
        for (const step of steps) {
          if (step.action === "navigate" && step.target) {
            try { urls.add(new URL(step.target, baseUrl || undefined).href); }
            catch { /* skip invalid */ }
          }
        }
        if (urls.size > 0) {
          toast.info(`Scraping ${urls.size} page(s) for context...`);
          for (const url of urls) {
            try {
              const result = await scrapePageViaExtension(extensionId, url);
              if (result.html) pageContexts.push({ url, html: result.html });
            } catch { /* skip */ }
          }
        }
      }

      if (pageContexts.length === 0) {
        toast.info("No page context available — AI will refine based on step logic only");
      }

      const res = await generateApi.refine(
        testCases,
        pageContexts.length > 0 ? pageContexts : [{ url: baseUrl || "unknown", html: "" }],
        baseUrl || undefined
      );
      const refined = res.data.testCases?.[0];
      if (!refined || !refined.steps?.length) {
        toast.warning("AI returned no refinements");
        return;
      }

      // Rebuild the graph from the refined steps
      const { nodes: newNodes, edges: newEdges } = buildFlowFromSteps(refined.steps);
      setNodes(newNodes);
      setEdges(newEdges);
      if (refined.name) setTestCaseName(refined.name);
      if (refined.description) setTestCaseDescription(refined.description);
      toast.success("Test case refined by AI");
    } catch (err: any) {
      toast.error(err.message || "Failed to refine test case");
    } finally {
      setRefining(false);
    }
  }

  /** Save then execute the test case via the browser extension. */
  async function handleRun() {
    setRunning(true);
    try {
      await handleSave();
      await runTestCase(testCaseId);
    } catch (err: any) {
      toast.error(err.message || "Failed to run test case");
    } finally {
      setRunning(false);
    }
  }

  /** Download the test case in the requested format. */
  async function handleExport(format: "json" | "docx" | "pdf") {
    try {
      const blob = await exportApi.testCase(testCaseId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `test-case.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    }
  }

  /** Delete the test case and navigate back to the list. */
  async function handleDelete() {
    try {
      await testCasesApi.delete(testCaseId);
      toast.success("Test case deleted");
      router.push("/test-cases");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  return {
    // Refs
    reactFlowWrapper,
    // Flow state
    nodes, edges, selectedNode,
    onNodesChange, onEdgesChange, onConnect,
    onNodeClick, onPaneClick, onDragOver, onDrop,
    updateNodeData, deleteNode,
    // Metadata
    testCaseName, setTestCaseName,
    testCaseDescription, setTestCaseDescription,
    testCasePreconditions, setTestCasePreconditions,
    testCasePassingCriteria, setTestCasePassingCriteria,
    testCaseTags, setTestCaseTags,
    tagsInput, setTagsInput,
    showMetadata, setShowMetadata,
    // UI flags
    loaded, saving, running, refining, hasChanges,
    // Actions
    handleSave, handleValidate, handleRefine, handleRun, handleExport, handleDelete,
  };
}
