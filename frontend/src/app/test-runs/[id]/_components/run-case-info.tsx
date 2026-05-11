/**
 * Test case info card for the test-run detail page.
 *
 * Shows the test case name, ID, description, preconditions, and
 * passing criteria with a link to the flow editor.
 */

"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface RunCaseInfoProps {
  /** Test case ID. */
  testCaseId: string;
  /** Display name. */
  testCaseName?: string;
  /** Optional description. */
  testCaseDescription?: string;
  /** Optional preconditions. */
  testCasePreconditions?: string;
  /** Optional passing criteria. */
  testCasePassingCriteria?: string;
}

/**
 * Renders a card with metadata about the test case that produced this run.
 *
 * @param props - Test case fields from the run record.
 */
export function RunCaseInfo({
  testCaseId, testCaseName, testCaseDescription,
  testCasePreconditions, testCasePassingCriteria,
}: RunCaseInfoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Case Info</CardTitle>
          <Link href={`/test-cases/${testCaseId}/editor`}>
            <Button variant="outline">
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Test Case
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-1">Name</p>
            <p>{testCaseName || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-semibold mb-1">Case ID</p>
            <Link href={`/test-cases/${testCaseId}/editor`} className="text-primary hover:underline font-mono text-xs">
              {testCaseId}
            </Link>
          </div>
          {testCaseDescription && (
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-xs font-semibold mb-1">Description</p>
              <p className="text-muted-foreground">{testCaseDescription}</p>
            </div>
          )}
          {testCasePreconditions && (
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-xs font-semibold mb-1">Preconditions</p>
              <p className="text-muted-foreground">{testCasePreconditions}</p>
            </div>
          )}
          {testCasePassingCriteria && (
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-xs font-semibold mb-1">Passing Criteria</p>
              <p className="text-muted-foreground">{testCasePassingCriteria}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
