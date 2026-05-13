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
  getConnectedEdges,
} from "@xyflow/react";
import { toast } from "sonner";

import { testCasesApi, exportApi, generateApi, testRunsApi } from "@/lib/api";
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
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // ── Last test run data (for inline result panel) ──
  const [lastRun, setLastRun] = useState<{
    id: string;
    status: string;
    startedAt: string;
    stepResults: any[];
  } | null>(null);

  // ── Undo / Redo history ──
  type Snapshot = { nodes: Node[]; edges: Edge[] };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const isUndoRedo = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Push current state onto the undo stack (call before mutations). */
  const pushUndo = useCallback(() => {
    undoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (undoStack.current.length > 50) undoStack.current.shift(); // cap history
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    isUndoRedo.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [nodes, edges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    isUndoRedo.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [nodes, edges, setNodes, setEdges]);

  // ── Clipboard (copy / cut / paste) ──
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  const handleCopy = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const connectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
    clipboard.current = { nodes: structuredClone(selected), edges: structuredClone(connectedEdges) };
    toast.success(`Copied ${selected.length} block(s)`);
  }, [nodes, edges]);

  const handleCut = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    pushUndo();
    const selectedIds = new Set(selected.map((n) => n.id));
    const connectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
    clipboard.current = { nodes: structuredClone(selected), edges: structuredClone(connectedEdges) };
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
    setSelectedNode(null);
    toast.success(`Cut ${selected.length} block(s)`);
  }, [nodes, edges, pushUndo, setNodes, setEdges]);

  const handlePaste = useCallback(() => {
    if (!clipboard.current || clipboard.current.nodes.length === 0) return;
    pushUndo();
    const offset = 40;
    const idMap = new Map<string, string>();
    const newNodes = clipboard.current.nodes.map((n) => {
      const newId = `${n.data?.blockType || "node"}-${++nodeIdCounter}`;
      idMap.set(n.id, newId);
      // Strip executionStatus so pasted blocks don't inherit highlights
      const { executionStatus, ...cleanData } = (n.data || {}) as any;
      return {
        ...n,
        id: newId,
        data: cleanData,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
      };
    });
    const newEdges = clipboard.current.edges.map((e) => ({
      ...e,
      id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    }));
    // Deselect existing nodes
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    toast.success(`Pasted ${newNodes.length} block(s)`);
  }, [pushUndo, setNodes, setEdges]);

  // ── Track node/edge changes for undo ──
  // Capture a snapshot at the START of a drag/batch, then ignore further
  // changes until 300ms of inactivity (i.e. the drag has ended).
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnap = useRef<Snapshot | null>(null);

  const flushPendingSnap = useCallback(() => {
    if (pendingSnap.current) {
      undoStack.current.push(pendingSnap.current);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
      pendingSnap.current = null;
    }
  }, []);

  const wrappedOnNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      const isSubstantive = changes.some(
        (c: any) => c.type !== "select" && c.type !== "dimensions"
      );
      if (isSubstantive && !isUndoRedo.current) {
        // Only capture the snapshot once at the start of the gesture
        if (!pendingSnap.current) {
          pendingSnap.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
        }
        // Reset the debounce timer — flush when idle for 300ms
        if (changeTimer.current) clearTimeout(changeTimer.current);
        changeTimer.current = setTimeout(flushPendingSnap, 300);
      }
      isUndoRedo.current = false;
      onNodesChange(changes);
    },
    [nodes, edges, onNodesChange, flushPendingSnap]
  );

  const wrappedOnEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      const isSubstantive = changes.some((c: any) => c.type !== "select");
      if (isSubstantive && !isUndoRedo.current) {
        if (!pendingSnap.current) {
          pendingSnap.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
        }
        if (changeTimer.current) clearTimeout(changeTimer.current);
        changeTimer.current = setTimeout(flushPendingSnap, 300);
      }
      isUndoRedo.current = false;
      onEdgesChange(changes);
    },
    [nodes, edges, onEdgesChange, flushPendingSnap]
  );

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

      // Load the latest test run for this test case (if any)
      try {
        const runs = await testRunsApi.list({ testCaseId });
        const latestRun = runs.data?.[0];
        if (latestRun?.id) {
          const runDetail = await testRunsApi.get(latestRun.id);
          const steps: any[] = runDetail.data?.stepResults || [];
          setLastRun({
            id: latestRun.id,
            status: runDetail.data?.status || latestRun.status,
            startedAt: runDetail.data?.startedAt || latestRun.startedAt,
            stepResults: steps,
          });

          // Apply execution status highlights to nodes
          if (steps.length > 0) {
            setNodes((nds) =>
              nds.map((n) => {
                const step = [...steps]
                  .reverse()
                  .find((s: any) => s.blockId === n.id && !s.retry);
                if (step) {
                  return { ...n, data: { ...n.data, executionStatus: step.status } };
                }
                return n;
              })
            );
          }
        }
      } catch {
        // No previous runs — that's fine
      }
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

  // ── Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+S) ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      switch (e.key.toLowerCase()) {
        case "z":
          if (e.shiftKey) { handleRedo(); } else { handleUndo(); }
          e.preventDefault();
          break;
        case "y":
          handleRedo();
          e.preventDefault();
          break;
        case "c":
          handleCopy();
          e.preventDefault();
          break;
        case "x":
          handleCut();
          e.preventDefault();
          break;
        case "v":
          handlePaste();
          e.preventDefault();
          break;
        case "s":
          handleSave();
          e.preventDefault();
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo, handleCopy, handleCut, handlePaste]);

  // ── ReactFlow event handlers ──

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => {
        // Enforce single-edge-per-handle: reject if the source handle or
        // target handle already has a connection.
        const sourceHandle = connection.sourceHandle || null;
        const targetHandle = connection.targetHandle || null;

        const sourceOccupied = eds.some(
          (e) => e.source === connection.source && (e.sourceHandle || null) === sourceHandle
        );
        const targetOccupied = eds.some(
          (e) => e.target === connection.target && (e.targetHandle || null) === targetHandle
        );

        if (sourceOccupied) {
          toast.warning("This output is already connected. Remove the existing edge first.");
          return eds;
        }
        if (targetOccupied) {
          toast.warning("This input is already connected. Remove the existing edge first.");
          return eds;
        }

        return addEdge({ ...connection, animated: true }, eds);
      });
    },
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
    // Clear any previous execution highlights
    setNodes((nds) =>
      nds.map((n) => {
        if (n.data?.executionStatus) {
          const { executionStatus, ...rest } = n.data as any;
          return { ...n, data: rest };
        }
        return n;
      })
    );
    try {
      await handleSave();
      await runTestCase(testCaseId);

      // After run completes, fetch step results and highlight nodes
      try {
        const runs = await testRunsApi.list({ testCaseId });
        const latestRun = runs.data?.[0];
        if (latestRun?.id) {
          const runDetail = await testRunsApi.get(latestRun.id);
          const steps: any[] = runDetail.data?.stepResults || [];

          // Store run data for the inline result panel
          setLastRun({
            id: latestRun.id,
            status: runDetail.data?.status || latestRun.status,
            startedAt: runDetail.data?.startedAt || latestRun.startedAt,
            stepResults: steps,
          });

          if (steps.length > 0) {
            let failedNodeToSelect: Node | null = null;
            const failedStep = steps.find((s: any) => s.status === "failed" && !s.retry);

            setNodes((nds) => {
              const updated = nds.map((n) => {
                const step = [...steps]
                  .reverse()
                  .find((s: any) => s.blockId === n.id && !s.retry);
                if (step) {
                  // Track the first failed node for auto-selection
                  if (step.status === "failed" && !failedNodeToSelect) {
                    failedNodeToSelect = { ...n, data: { ...n.data, executionStatus: step.status } };
                  }
                  return { ...n, data: { ...n.data, executionStatus: step.status } };
                }
                return n;
              });
              return updated;
            });

            // Auto-select the first failed node so the user sees it immediately
            if (failedNodeToSelect) {
              setSelectedNode(failedNodeToSelect);
            }
          }
        }
      } catch {
        // Non-critical — highlighting is best-effort
      }
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
    onNodesChange: wrappedOnNodesChange,
    onEdgesChange: wrappedOnEdgesChange,
    onConnect,
    onNodeClick, onPaneClick, onDragOver, onDrop,
    updateNodeData, deleteNode,
    // Undo / Redo / Clipboard
    canUndo, canRedo, handleUndo, handleRedo,
    handleCopy, handleCut, handlePaste,
    // Metadata
    testCaseName, setTestCaseName,
    testCaseTags, setTestCaseTags,
    tagsInput, setTagsInput,
    // UI flags
    loaded, saving, running, refining, hasChanges,
    // Last run
    lastRun,
    // Actions
    handleSave, handleValidate, handleRefine, handleRun, handleExport, handleDelete,
  };
}
