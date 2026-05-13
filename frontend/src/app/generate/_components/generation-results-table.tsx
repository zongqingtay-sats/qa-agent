/**
 * Table displaying AI-generated test cases with select-all / save controls.
 *
 * Shown after generation completes. Each row has a checkbox so the user
 * can pick which cases to save to the backend.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2 } from "lucide-react";
import type { GeneratedTestCase } from "@/types/api";

interface GenerationResultsTableProps {
  /** The list of generated test cases. */
  cases: GeneratedTestCase[];
  /** Set of selected indices. */
  selected: Set<number>;
  /** Toggle a single row's selection. */
  onToggle: (index: number) => void;
  /** Toggle all rows. */
  onToggleAll: () => void;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Persist selected cases to the backend. */
  onSave: () => void;
}

/**
 * Renders a selectable table of generated test cases with a "Save" action.
 *
 * @param props - Case data, selection state, and callbacks.
 */
export function GenerationResultsTable({
  cases, selected, onToggle, onToggleAll, saving, onSave,
}: GenerationResultsTableProps) {
  if (cases.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Generated Test Cases</CardTitle>
            <CardDescription>{cases.length} test case(s) generated</CardDescription>
          </div>
          <Button onClick={onSave} disabled={saving || selected.size === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
            Save {selected.size} Selected
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selected.size === cases.length}
                  onCheckedChange={onToggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((tc, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => onToggle(i)}
                  />
                </TableCell>
                <TableCell className="font-medium">{tc.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {tc.description}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{tc.steps?.length || 0} steps</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
