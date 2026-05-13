/**
 * Toolbar action buttons for the flow editor header.
 *
 * Layout: Undo Redo | Validate Run | Save | ⋯ (Export, Refine, Delete)
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Save, Play, Download, Trash2, ListChecks, Sparkles, Loader2, Undo2, Redo2, MoreVertical } from "lucide-react";

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
      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 mr-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Validate & Run */}
      <Button variant="outline" onClick={onValidate}>
        <ListChecks className="h-4 w-4 mr-1" /> Validate
      </Button>
      <Button variant="outline" onClick={onRun} disabled={running || saving}>
        <Play className="h-4 w-4 mr-1" /> {running ? "Running..." : "Run"}
      </Button>

      {/* Save */}
      {hasChanges && (
        <Button onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
        </Button>
      )}

      {/* Ellipsis menu */}
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        } />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onExport("json")}>
            <Download className="h-4 w-4 mr-2" /> Export as JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("docx")}>
            <Download className="h-4 w-4 mr-2" /> Export as DOCX
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("pdf")}>
            <Download className="h-4 w-4 mr-2" /> Export as PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRefine} disabled={refining || saving}>
            {refining ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {refining ? "Refining..." : "Refine with AI"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
