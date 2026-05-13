/**
 * Clipboard and undo/redo utilities for the flow editor.
 *
 * Manages a snapshot-based undo/redo stack and a clipboard buffer
 * for copy/cut/paste operations on ReactFlow nodes and edges.
 *
 * Uses `structuredClone` for deep copies so mutations to the live
 * graph never corrupt history entries.
 */

import { useCallback, useRef, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { toast } from "sonner";

/** A point-in-time snapshot of the entire flow graph. */
export type Snapshot = { nodes: Node[]; edges: Edge[] };

/** Maximum number of undo entries kept in memory. */
const MAX_HISTORY = 50;

/**
 * Hook providing undo/redo/clipboard operations for the flow editor.
 *
 * @param nodes    - Current node array (live state).
 * @param edges    - Current edge array (live state).
 * @param setNodes - Setter to replace all nodes.
 * @param setEdges - Setter to replace all edges.
 * @param setSelectedNode - Setter to clear the selected node on cut.
 * @returns Undo/redo state flags, clipboard handlers, and change-tracking helpers.
 */
export function useFlowClipboard(
  nodes: Node[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>,
) {
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const isUndoRedo = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Push the current state onto the undo stack (call before mutations). */
  const pushUndo = useCallback(() => {
    undoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [nodes, edges]);

  /** Restore previous state from the undo stack. */
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

  /** Re-apply a previously undone state from the redo stack. */
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

  // ── Clipboard ──

  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  /** Copy selected nodes (and their inter-edges) to the clipboard. */
  const handleCopy = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const selectedIds = new Set(selected.map((n) => n.id));
    const connectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
    clipboard.current = { nodes: structuredClone(selected), edges: structuredClone(connectedEdges) };
    toast.success(`Copied ${selected.length} block(s)`);
  }, [nodes, edges]);

  /** Cut selected nodes — copies then removes them from the graph. */
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
  }, [nodes, edges, pushUndo, setNodes, setEdges, setSelectedNode]);

  /** Paste from clipboard with offset and new IDs. */
  const handlePaste = useCallback(
    (nodeIdCounter: { current: number }) => {
      if (!clipboard.current || clipboard.current.nodes.length === 0) return;
      pushUndo();
      const offset = 40;
      const idMap = new Map<string, string>();
      const newNodes = clipboard.current.nodes.map((n) => {
        const newId = `${n.data?.blockType || "node"}-${++nodeIdCounter.current}`;
        idMap.set(n.id, newId);
        // Strip executionStatus so pasted blocks don't inherit highlights
        const { executionStatus, ...cleanData } = (n.data || {}) as Record<string, unknown>;
        return { ...n, id: newId, data: cleanData, position: { x: n.position.x + offset, y: n.position.y + offset }, selected: true };
      });
      const newEdges = clipboard.current.edges.map((e) => ({
        ...e,
        id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}`,
        source: idMap.get(e.source) || e.source,
        target: idMap.get(e.target) || e.target,
      }));
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      toast.success(`Pasted ${newNodes.length} block(s)`);
    },
    [pushUndo, setNodes, setEdges],
  );

  // ── Debounced change tracking for undo snapshots ──

  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnap = useRef<Snapshot | null>(null);

  /** Flush a pending snapshot into the undo stack when idle. */
  const flushPendingSnap = useCallback(() => {
    if (pendingSnap.current) {
      undoStack.current.push(pendingSnap.current);
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
      pendingSnap.current = null;
    }
  }, []);

  return {
    canUndo, canRedo, isUndoRedo,
    pushUndo, handleUndo, handleRedo,
    handleCopy, handleCut, handlePaste,
    // Change tracking internals (used by wrappedOnNodesChange / wrappedOnEdgesChange)
    changeTimer, pendingSnap, flushPendingSnap,
  };
}
