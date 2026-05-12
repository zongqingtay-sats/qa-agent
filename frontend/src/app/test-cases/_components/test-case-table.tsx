/**
 * Test case list table component.
 *
 * Renders all test cases in a table with checkboxes, inline actions
 * (run, delete, export), tags, and status badges.
 */

"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Play, Trash2, Download } from "lucide-react";

interface TestCaseTableProps {
  /** The list of test cases to display. */
  testCases: any[];
  /** Whether data is still loading. */
  loading: boolean;
  /** Set of currently selected test case IDs. */
  selected: Set<string>;
  /** Toggle one row's selection. */
  onToggleSelect: (id: string) => void;
  /** Toggle all rows. */
  onToggleSelectAll: () => void;
  /** Run a single test case. */
  onRun: (id: string) => void;
  /** Delete a single test case. */
  onDelete: (id: string) => void;
  /** Export a single test case. */
  onExport: (id: string, format: "json" | "docx" | "pdf") => void;
}

/**
 * Renders the main test-cases table with per-row actions.
 *
 * @param props - Data, selection state, and action callbacks.
 */
export function TestCaseTable({
  testCases, loading, selected,
  onToggleSelect, onToggleSelectAll,
  onRun, onDelete, onExport,
}: TestCaseTableProps) {
  const router = useRouter();

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={testCases.length > 0 && selected.size === testCases.length}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
            </TableRow>
          ) : testCases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No test cases found. Create one or import from a document.
              </TableCell>
            </TableRow>
          ) : (
            testCases.map((tc) => (
              <TableRow key={tc.id} className="cursor-pointer" onClick={() => router.push(`/test-cases/${tc.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(tc.id)} onCheckedChange={() => onToggleSelect(tc.id)} />
                </TableCell>
                <TableCell className="font-medium">{tc.name}</TableCell>
                <TableCell><StatusBadge status={tc.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(tc.tags || []).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(tc.updatedAt).toLocaleString()}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Run" onClick={() => onRun(tc.id)}>
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => onDelete(tc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Export"><Download className="h-3 w-3" /></Button>
                      } />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onExport(tc.id, "json")}>Export as JSON</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(tc.id, "docx")}>Export as DOCX</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onExport(tc.id, "pdf")}>Export as PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
