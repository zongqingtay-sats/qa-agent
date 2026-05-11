/**
 * Toolbar action buttons for the flow editor header.
 *
 * Contains Validate, Refine, Run, Export, Delete, and Save buttons.
 * The Save button only appears when there are unsaved changes.
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Save, Play, Download, Trash2, ListChecks, Sparkles, Loader2, Undo2, Redo2 } from "lucide-react";

interface EditorToolbarProps {
  /** Whether the flow is currently being saved. */
  saving: boolean;
  /** Whether the flow is currently being refined by AI. */
  refining: boolean;
  /** Whether a test run is in progress. */
  running: boolean;
  /** Whether there are unsaved changes (shows the Save button). */
  hasChanges: boolean;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
  /** Callbacks for each toolbar action. */
  onValidate: () => void;
  onRefine: () => void;
  onRun: () => void;
  onSave: () => void;
  onDelete: () => void;
  onExport: (format: "json" | "docx" | "pdf") => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Renders the row of action buttons shown in the editor page header.
 *
 * @param props - Button states and action callbacks.
 */
export function EditorToolbar({
  saving, refining, running, hasChanges, canUndo, canRedo,
  onValidate, onRefine, onRun, onSave, onDelete, onExport, onUndo, onRedo,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 mr-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
      <Button variant="outline" onClick={onValidate}>
        <ListChecks className="h-4 w-4 mr-1" /> Validate
      </Button>
      <Button variant="outline" onClick={onRefine} disabled={refining || saving}>
        {refining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
        {refining ? "Refining..." : "Refine"}
      </Button>
      <Button variant="outline" onClick={onRun} disabled={running || saving}>
        <Play className="h-4 w-4 mr-1" /> {running ? "Running..." : "Run"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="outline">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        } />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("json")}>Export as JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("docx")}>Export as DOCX</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("pdf")}>Export as PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" className="text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-1" /> Delete
      </Button>
      {hasChanges && (
        <Button onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
}
