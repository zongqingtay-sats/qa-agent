/**
 * Flow editor page for a single test case.
 *
 * Composes the block palette, ReactFlow canvas, properties panel,
 * metadata section, and toolbar into a full-page editor layout.
 * All state and business logic lives in the `useFlowEditor` hook.
 */

"use client";

import { useParams } from "next/navigation";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PageHeader } from "@/components/layout/page-header";
import { nodeTypes } from "./_components/flow-block-node";
import { BlockPalette } from "./_components/block-palette";
import { BlockPropertiesPanel } from "./_components/block-properties-panel";
import { EditorToolbar } from "./_components/editor-toolbar";
import { MetadataPanel } from "./_components/metadata-panel";
import { LastRunPanel } from "./_components/last-run-panel";
import { useFlowEditor } from "./_hooks/use-flow-editor";

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
            className="bg-transparent border-none outline-none text-lg font-semibold w-full max-w-md"
            placeholder="Test case name..."
          />
        }
        actions={
          <EditorToolbar
            saving={editor.saving}
            refining={editor.refining}
            running={editor.running}
            hasChanges={editor.hasChanges}
            onValidate={editor.handleValidate}
            onRefine={editor.handleRefine}
            onRun={editor.handleRun}
            onSave={editor.handleSave}
            onDelete={editor.handleDelete}
            onExport={editor.handleExport}
          />
        }
      />

      <MetadataPanel
        open={editor.showMetadata}
        onToggle={() => editor.setShowMetadata(!editor.showMetadata)}
        description={editor.testCaseDescription}
        onDescriptionChange={editor.setTestCaseDescription}
        preconditions={editor.testCasePreconditions}
        onPreconditionsChange={editor.setTestCasePreconditions}
        passingCriteria={editor.testCasePassingCriteria}
        onPassingCriteriaChange={editor.setTestCasePassingCriteria}
        tagsInput={editor.tagsInput}
        onTagsInputChange={editor.setTagsInput}
        onTagsCommit={() =>
          editor.setTestCaseTags(
            editor.tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
          )
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
          onUpdate={editor.updateNodeData}
          onDelete={editor.deleteNode}
        />
      </div>
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
