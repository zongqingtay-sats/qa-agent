/**
 * Collapsible metadata panel for test case details.
 *
 * Displays description, preconditions, passing criteria, and tags
 * in a toggleable section below the editor toolbar.
 */

"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight } from "lucide-react";

interface MetadataPanelProps {
  /** Whether the panel is currently expanded. */
  open: boolean;
  /** Toggle the panel open/closed. */
  onToggle: () => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  preconditions: string;
  onPreconditionsChange: (v: string) => void;
  passingCriteria: string;
  onPassingCriteriaChange: (v: string) => void;
}

/**
 * Renders the collapsible "Test Case Details" section with metadata fields.
 *
 * @param props - Current field values and change handlers.
 */
export function MetadataPanel({
  open, onToggle,
  description, onDescriptionChange,
  preconditions, onPreconditionsChange,
  passingCriteria, onPassingCriteriaChange,
}: MetadataPanelProps) {
  return (
    <div className="border-b">
      <button
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 w-full text-left hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">Test Case Details</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What does this test case verify?"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Preconditions</Label>
            <Textarea
              value={preconditions}
              onChange={(e) => onPreconditionsChange(e.target.value)}
              placeholder="Setup required before running this test"
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Passing Criteria</Label>
            <Textarea
              value={passingCriteria}
              onChange={(e) => onPassingCriteriaChange(e.target.value)}
              placeholder="What determines if this test passes?"
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
