/**
 * Summary cards shown at the top of the test-run detail page.
 *
 * Displays status, step progress, duration, and date in a
 * responsive 4-column grid.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RunSummaryCardsProps {
  /** Current run status (e.g. "passed", "failed", "running"). */
  status: string;
  /** Number of steps that passed. */
  passedSteps: number;
  /** Total expected steps. */
  totalSteps: number;
  /** Total execution time in milliseconds, or `null` if not finished. */
  durationMs: number | null;
  /** ISO timestamp of when the run started. */
  startedAt: string;
}

/**
 * Renders four summary cards for a test run.
 *
 * @param props - Summarised run data.
 */
export function RunSummaryCards({
  status, passedSteps, totalSteps, durationMs, startedAt,
}: RunSummaryCardsProps) {
  const statusColor =
    status === "passed" ? "text-green-600" :
    status === "failed" ? "text-red-600" :
    "text-blue-600";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-xl font-bold ${statusColor}`}>{status.toUpperCase()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            <span className="text-green-600">{passedSteps}</span>
            <span className="text-muted-foreground"> / {totalSteps}</span>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">
            {durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium">{new Date(startedAt).toLocaleString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
