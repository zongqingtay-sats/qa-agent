/**
 * Editable details card for a test case overview page.
 *
 * Renders inline-editable Description, Preconditions, Passing Criteria,
 * Tags, Status, and ID fields.
 *
 * @module details-card
 */

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

/** Props for {@link DetailsCard}. */
export interface DetailsCardProps {
  testCaseId: string;
  status: string;
  descriptionInput: string;
  setDescriptionInput: (v: string) => void;
  handleDescriptionCommit: () => void;
  originalDescription: string;
  preconditionsInput: string;
  setPreconditionsInput: (v: string) => void;
  handlePreconditionsCommit: () => void;
  originalPreconditions: string;
  passingCriteriaInput: string;
  setPassingCriteriaInput: (v: string) => void;
  handlePassingCriteriaCommit: () => void;
  originalPassingCriteria: string;
  tagsInput: string;
  setTagsInput: (v: string) => void;
  handleTagsCommit: () => void;
}

/**
 * Card with inline-editable metadata fields for a test case.
 *
 * @param props - See {@link DetailsCardProps}.
 */
export function DetailsCard(props: DetailsCardProps) {
  const {
    testCaseId, status,
    descriptionInput, setDescriptionInput, handleDescriptionCommit, originalDescription,
    preconditionsInput, setPreconditionsInput, handlePreconditionsCommit, originalPreconditions,
    passingCriteriaInput, setPassingCriteriaInput, handlePassingCriteriaCommit, originalPassingCriteria,
    tagsInput, setTagsInput, handleTagsCommit,
  } = props;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
      <CardContent className="flex gap-4">
        <div className="space-y-3 flex-1">
          <EditableField label="Description" value={descriptionInput} onChange={setDescriptionInput}
            onBlur={handleDescriptionCommit} onEscape={originalDescription} placeholder="Add a description" />
          <EditableField label="Preconditions" value={preconditionsInput} onChange={setPreconditionsInput}
            onBlur={handlePreconditionsCommit} onEscape={originalPreconditions} placeholder="Setup required before running..." />
          <EditableField label="Passing Criteria" value={passingCriteriaInput} onChange={setPassingCriteriaInput}
            onBlur={handlePassingCriteriaCommit} onEscape={originalPassingCriteria} placeholder="What determines if this test passes?" />
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-1">ID</p>
            <Link href={`/test-cases/${testCaseId}/editor`} className="text-primary hover:underline font-mono text-xs">{testCaseId}</Link>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-1">Status</p>
            <StatusBadge status={status} />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-1">Tags</p>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} onBlur={handleTagsCommit}
              placeholder="Add tags" className="flex-1 text-sm bg-transparent border-none outline-none p-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Internal helper — renders a single editable textarea field. */
function EditableField({ label, value, onChange, onBlur, onEscape, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur: () => void; onEscape: string; placeholder: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-semibold mb-1">{label}</p>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Escape") { onChange(onEscape); (e.target as HTMLTextAreaElement).blur(); } }}
        placeholder={placeholder} rows={3}
        className="flex-1 text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground w-full" />
    </div>
  );
}
