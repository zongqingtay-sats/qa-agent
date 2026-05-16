/**
 * Flow editor page for a single test case.
 *
 * Composes the block palette, ReactFlow canvas, properties panel,
 * metadata section, and toolbar into a full-page editor layout.
 * All state and business logic lives in the `useFlowEditor` hook.
 */

"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { nodeTypes } from "./_components/flow-block-node";
import { BlockPalette } from "./_components/block-palette";
import { BlockPropertiesPanel } from "./_components/block-properties-panel";
import { EditorToolbar } from "./_components/editor-toolbar";
import { LastRunPanel } from "./_components/last-run-panel";
import { useFlowEditor } from "./_hooks/use-flow-editor";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";

/**
 * Inner editor component (must be wrapped in ReactFlowProvider).
 *
 * Reads the test case ID from the URL params and delegates all
 * state management to the `useFlowEditor` hook.
 */
function FlowEditorInner() {
  const params = useParams();
  const testCaseId = params.id as string;

  const editor = useFlowEditor(testCaseId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useBreadcrumbLabel(testCaseId, editor.testCaseName || undefined);

  if (!editor.loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <input
            value={editor.testCaseName}
            onChange={(e) => editor.setTestCaseName(e.target.value)}
            className="bg-transparent border-none outline-none text-lg font-semibold w-full"
            placeholder="Test case name..."
          />
        }
        actions={
          <EditorToolbar
            saving={editor.saving}
            refining={editor.refining}
            running={editor.running}
            hasChanges={editor.hasChanges}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onValidate={editor.handleValidate}
            onRefine={editor.handleRefine}
            onRun={editor.handleRun}
            onSave={editor.handleSave}
            onDelete={() => setDeleteDialogOpen(true)}
            onExport={editor.handleExport}
            onUndo={editor.handleUndo}
            onRedo={editor.handleRedo}
          />
        }
      />

      {editor.lastRun && (
        <LastRunPanel
          run={editor.lastRun}
          selectedNodeId={editor.selectedNode?.id}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <BlockPalette />
        <div ref={editor.reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={editor.nodes}
            edges={editor.edges}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onConnect={editor.onConnect}
            onNodeClick={editor.onNodeClick}
            onPaneClick={editor.onPaneClick}
            onDragOver={editor.onDragOver}
            onDrop={editor.onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-muted/20"
          >
            <Controls />
            <MiniMap />
            <Background gap={16} size={1} />
          </ReactFlow>
        </div>
        <BlockPropertiesPanel
          node={editor.selectedNode}
          nodes={editor.nodes}
          onUpdate={editor.updateNodeData}
          onDelete={editor.deleteNode}
        />
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test Case</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{editor.testCaseName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setDeleteDialogOpen(false); editor.handleDelete(); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Page-level export wrapping the editor in a ReactFlowProvider.
 *
 * The provider must sit above any component that calls `useReactFlow()`.
 */
export default function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
