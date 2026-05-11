/**
 * Collapsible metadata panel for test case details.
 *
 * Displays description, preconditions, passing criteria, and tags
 * in a toggleable section below the editor toolbar.
 */

"use client";

import { Input } from "@/components/ui/input";
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
  tagsInput: string;
  onTagsInputChange: (v: string) => void;
  /** Called on blur to commit the comma-separated tags string. */
  onTagsCommit: () => void;
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
  tagsInput, onTagsInputChange, onTagsCommit,
}: MetadataPanelProps) {
  return (
    <div className="border-b">
      <button
        type="button"
        className="flex items-center gap-1.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground w-full text-left"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Test Case Details
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
          <div className="space-y-1.5">
            <Label className="text-xs">Tags</Label>
            <Input
              value={tagsInput}
              onChange={(e) => onTagsInputChange(e.target.value)}
              onBlur={onTagsCommit}
              placeholder="e.g. login, smoke, regression"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>
        </div>
      )}
    </div>
  );
}
