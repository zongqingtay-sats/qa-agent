"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, CheckCircle2, XCircle, Clock, Image as ImageIcon } from "lucide-react";
import { testRunsApi, exportApi } from "@/lib/api";
import { toast } from "sonner";

export default function TestRunDetailPage() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRun();
  }, [runId]);

  // Poll for updates while the run is in progress
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const interval = setInterval(loadRun, 2000);
    return () => clearInterval(interval);
  }, [run?.status]);

  async function loadRun() {
    try {
      const res = await testRunsApi.get(runId);
      setRun(res.data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(format: 'json' | 'docx' | 'pdf') {
    try {
      const blob = await exportApi.testRun(runId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-run-${runId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Test Run Detail" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </>
    );
  }

  if (!run) {
    return (
      <>
        <PageHeader title="Test Run Detail" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Test run not found</p>
        </div>
      </>
    );
  }

  const statusColor = run.status === 'passed' ? 'text-green-600' : run.status === 'failed' ? 'text-red-600' : 'text-blue-600';

  return (
    <>
      <PageHeader
        title={run.testCaseName || "Test Run"}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('json')}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>Export as DOCX</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-5xl">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${statusColor}`}>{run.status.toUpperCase()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">
                  <span className="text-green-600">{run.passedSteps}</span>
                  <span className="text-muted-foreground"> / {run.totalSteps}</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">
                  {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{new Date(run.startedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Description & Criteria */}
          {(run.testCaseDescription || run.testCasePassingCriteria) && (
            <Card>
              <CardContent className="space-y-4">
                {run.testCaseDescription && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Description</h3>
                    <p className="text-sm text-muted-foreground">{run.testCaseDescription}</p>
                  </div>
                )}
                {run.testCasePassingCriteria && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Passing Criteria</h3>
                    <p className="text-sm text-muted-foreground">{run.testCasePassingCriteria}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step Results */}
          <Card>
            <CardHeader>
              <CardTitle>Step Results</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Screenshot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(run.stepResults || []).map((step: any) => (
                    <TableRow key={step.id} className={step.status === 'failed' ? 'bg-red-50' : ''}>
                      <TableCell className="font-mono text-sm">{step.stepOrder}</TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">{step.blockType}</Badge>
                          {step.description && (
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[150px] truncate">{step.target || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{step.expectedResult || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{step.actualResult || '—'}</TableCell>
                      <TableCell>
                        {step.status === 'passed' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Pass
                          </Badge>
                        ) : step.status === 'failed' ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Fail
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{step.status}</Badge>
                        )}
                        {step.errorMessage && (
                          <p className="text-xs text-red-600 mt-1">{step.errorMessage}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {step.durationMs ? `${step.durationMs}ms` : '—'}
                      </TableCell>
                      <TableCell>
                        {step.screenshotDataUrl ? (
                          <Dialog>
                            <DialogTrigger render={<Button variant="ghost" size="sm" className="h-8" />}>
                                <ImageIcon className="h-4 w-4 mr-1" /> View
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogTitle>Step {step.stepOrder} Screenshot</DialogTitle>
                              <img
                                src={step.screenshotDataUrl}
                                alt={`Step ${step.stepOrder} screenshot`}
                                className="w-full rounded border"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!run.stepResults || run.stepResults.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No step results recorded
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </>
  );
}
