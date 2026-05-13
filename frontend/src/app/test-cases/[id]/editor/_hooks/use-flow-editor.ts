/**
 * Custom hook encapsulating all state and event handlers for the
 * visual flow editor.
 *
 * Delegates undo/redo/clipboard to `flow-clipboard`, save/validate/
 * refine/run to `flow-actions`, and initial data loading to `flow-loader`.
 *
 * @param testCaseId - The ID of the test case being edited.
 */

"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type OnConnect, type Node, type Edge,
} from "@xyflow/react";
import { toast } from "sonner";

import type { StepResult, BlockData } from "@/types/api";
import { blockTypeToNodeType, getBlockConfig } from "../_components/block-config";
import { useFlowClipboard } from "../_lib/flow-clipboard";
import { loadFlowData } from "../_lib/flow-loader";
import { exportApi } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import {
  handleSave as doSave, handleValidate as doValidate,
  handleRefine as doRefine, handleRun as doRun,
  type FlowActionDeps,
} from "../_lib/flow-actions";

const nodeIdCounter = { current: 0 };

export function useFlowEditor(testCaseId: string) {
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [testCaseName, setTestCaseName] = useState("New Test Case");
  const [testCaseDescription, setTestCaseDescription] = useState("");
  const [testCasePreconditions, setTestCasePreconditions] = useState("");
  const [testCasePassingCriteria, setTestCasePassingCriteria] = useState("");
  const [testCaseTags, setTestCaseTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lastRun, setLastRun] = useState<{ id: string; status: string; startedAt: string; stepResults: StepResult[] } | null>(null);

  const clipboard = useFlowClipboard(nodes, edges, setNodes, setEdges, setSelectedNode);

  // ── Change-tracking wrappers ──

  const wrappedOnNodesChange: typeof onNodesChange = useCallback((changes) => {
    const isSubstantive = changes.some((c: Record<string, unknown>) => c.type !== "select" && c.type !== "dimensions");
    if (isSubstantive && !clipboard.isUndoRedo.current) {
      if (!clipboard.pendingSnap.current) clipboard.pendingSnap.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
      if (clipboard.changeTimer.current) clearTimeout(clipboard.changeTimer.current);
      clipboard.changeTimer.current = setTimeout(clipboard.flushPendingSnap, 300);
    }
    clipboard.isUndoRedo.current = false;
    onNodesChange(changes);
  }, [nodes, edges, onNodesChange, clipboard]);

  const wrappedOnEdgesChange: typeof onEdgesChange = useCallback((changes) => {
    const isSubstantive = changes.some((c: Record<string, unknown>) => c.type !== "select");
    if (isSubstantive && !clipboard.isUndoRedo.current) {
      if (!clipboard.pendingSnap.current) clipboard.pendingSnap.current = { nodes: structuredClone(nodes), edges: structuredClone(edges) };
      if (clipboard.changeTimer.current) clearTimeout(clipboard.changeTimer.current);
      clipboard.changeTimer.current = setTimeout(clipboard.flushPendingSnap, 300);
    }
    clipboard.isUndoRedo.current = false;
    onEdgesChange(changes);
  }, [nodes, edges, onEdgesChange, clipboard]);

  // ── Dirty-checking ──
  const initialSnapshot = useRef<string>("");
  const currentSnapshot = JSON.stringify({ testCaseName, testCaseDescription, testCasePreconditions, testCasePassingCriteria, testCaseTags, nodes, edges });
  const hasChanges = loaded && initialSnapshot.current !== "" && currentSnapshot !== initialSnapshot.current;
  useEffect(() => { if (loaded && !initialSnapshot.current) initialSnapshot.current = currentSnapshot; }, [loaded, currentSnapshot]);

  // ── Action deps ──
  const actionDeps: FlowActionDeps = {
    testCaseId, nodes, edges, testCaseName, testCaseDescription, testCasePreconditions,
    testCasePassingCriteria, testCaseTags, setNodes, setEdges, setTestCaseName,
    setTestCaseDescription, setSaving, setRunning, setRefining, setLastRun, setSelectedNode,
    initialSnapshot, currentSnapshot,
  };
  const handleSave = useCallback(() => doSave(actionDeps), [actionDeps]);
  const handleValidate = useCallback(() => doValidate(nodes, edges), [nodes, edges]);
  const handleRefine = useCallback(() => doRefine(actionDeps), [actionDeps]);
  const handleRun = useCallback(() => doRun(actionDeps), [actionDeps]);

  // ── Load on mount ──
  useEffect(() => {
    loadFlowData(testCaseId).then((result) => {
      setTestCaseName(result.name);
      setTestCaseDescription(result.description);
      setTestCasePreconditions(result.preconditions);
      setTestCasePassingCriteria(result.passingCriteria);
      setTestCaseTags(result.tags);
      setTagsInput(result.tags.join(", "));
      setNodes(result.nodes);
      setEdges(result.edges);
      nodeIdCounter.current = result.nodeIdCounter;
      setLastRun(result.lastRun);
      setLoaded(true);
    });
  }, [testCaseId]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      switch (e.key.toLowerCase()) {
        case "z": if (e.shiftKey) clipboard.handleRedo(); else clipboard.handleUndo(); e.preventDefault(); break;
        case "y": clipboard.handleRedo(); e.preventDefault(); break;
        case "c": clipboard.handleCopy(); e.preventDefault(); break;
        case "x": clipboard.handleCut(); e.preventDefault(); break;
        case "v": clipboard.handlePaste(nodeIdCounter); e.preventDefault(); break;
        case "s": handleSave(); e.preventDefault(); break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clipboard, handleSave]);

  // ── ReactFlow event handlers ──
  const onConnect: OnConnect = useCallback((connection) => {
    setEdges((eds) => {
      const srcH = connection.sourceHandle || null;
      const tgtH = connection.targetHandle || null;
      if (eds.some((e) => e.source === connection.source && (e.sourceHandle || null) === srcH)) {
        toast.warning("This output is already connected. Remove the existing edge first."); return eds;
      }
      if (eds.some((e) => e.target === connection.target && (e.targetHandle || null) === tgtH)) {
        toast.warning("This input is already connected. Remove the existing edge first."); return eds;
      }
      return addEdge({ ...connection, animated: true }, eds);
    });
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const blockType = event.dataTransfer.getData("application/reactflow-blocktype");
    if (!blockType) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const config = getBlockConfig(blockType);
    setNodes((nds) => [...nds, {
      id: `${blockType}-${++nodeIdCounter.current}`, type: blockTypeToNodeType(blockType),
      position, data: { label: config?.label || blockType, blockType },
    }]);
  }, [screenToFlowPosition, setNodes]);

  function updateNodeData(id: string, data: BlockData & Record<string, unknown>) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
    if (selectedNode?.id === id) setSelectedNode((prev) => (prev ? { ...prev, data } : null));
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  /** Export the test case in the specified format. */
  async function handleExport(format: "json" | "docx" | "pdf") {
    try {
      const blob = await exportApi.testCase(testCaseId, format);
      downloadBlob(blob, `${testCaseName || "test-case"}.${format}`);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  }

  return {
    reactFlowWrapper, nodes, edges, selectedNode, setSelectedNode,
    onNodesChange: wrappedOnNodesChange, onEdgesChange: wrappedOnEdgesChange,
    testCaseName, setTestCaseName, testCaseDescription, setTestCaseDescription,
    testCasePreconditions, setTestCasePreconditions, testCasePassingCriteria,
    setTestCasePassingCriteria, testCaseTags, setTestCaseTags, tagsInput, setTagsInput,
    saving, running, refining, loaded, hasChanges, lastRun,
    canUndo: clipboard.canUndo, canRedo: clipboard.canRedo,
    handleUndo: clipboard.handleUndo, handleRedo: clipboard.handleRedo,
    handleSave, handleValidate, handleRefine, handleRun, handleExport,
    handleDelete: () => router.push(`/test-cases/${testCaseId}`),
    onConnect, onNodeClick, onPaneClick, onDragOver, onDrop,
    updateNodeData, deleteNode,
  };
}
