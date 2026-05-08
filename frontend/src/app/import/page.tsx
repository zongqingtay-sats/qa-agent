"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, Check, X } from "lucide-react";
import { importApi, testCasesApi } from "@/lib/api";
import { toast } from "sonner";

export default function ImportPage() {
  const router = useRouter();
  const [parsing, setParsing] = useState(false);
  const [parsedCases, setParsedCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    setParsing(true);
    setParsedCases([]);

    try {
      const res = await importApi.parse(file);
      const testCases = res.data.testCases || [];
      setParsedCases(testCases);
      setSelected(new Set(testCases.map((_: any, i: number) => i)));
      toast.success(`Parsed ${testCases.length} test case(s) from ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSaveSelected() {
    setSaving(true);
    try {
      const toSave = parsedCases.filter((_, i) => selected.has(i));
      for (const tc of toSave) {
        // Convert steps to flow nodes
        const nodes: any[] = [
          { id: "start-1", type: "startNode", position: { x: 250, y: 0 }, data: { label: "Start", blockType: "start" } },
        ];
        const edges: any[] = [];

        (tc.steps || []).forEach((step: any, i: number) => {
          const nodeId = `step-${i + 1}`;
          const blockType = step.action || "click";
          nodes.push({
            id: nodeId,
            type: blockType === "assert" ? "assertNode" : blockType === "if-else" ? "conditionNode" : "actionNode",
            position: { x: 250, y: (i + 1) * 120 },
            data: {
              label: step.description || step.action,
              blockType,
              selector: step.target,
              url: blockType === "navigate" ? step.target : undefined,
              value: step.value,
              expectedValue: blockType === "assert" ? step.value : undefined,
              description: step.description,
            },
          });
          edges.push({
            id: `e-${i === 0 ? "start-1" : `step-${i}`}-${nodeId}`,
            source: i === 0 ? "start-1" : `step-${i}`,
            target: nodeId,
            animated: true,
          });
        });

        const endId = "end-1";
        nodes.push({
          id: endId,
          type: "endNode",
          position: { x: 250, y: (nodes.length) * 120 },
          data: { label: "End", blockType: "end" },
        });
        if (nodes.length > 2) {
          edges.push({
            id: `e-step-${tc.steps?.length || 0}-${endId}`,
            source: `step-${tc.steps?.length || 0}`,
            target: endId,
            animated: true,
          });
        }

        await testCasesApi.create({
          name: tc.name,
          description: tc.description || "",
          preconditions: tc.preconditions,
          passingCriteria: tc.passingCriteria,
          tags: tc.tags || [],
          flowData: { nodes, edges },
        });
      }

      toast.success(`Saved ${toSave.length} test case(s)`);
      router.push("/test-cases");
    } catch (err: any) {
      toast.error(err.message || "Failed to save test cases");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Import Test Cases" description="Upload documents to import or generate test cases" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        {/* Dropzone */}
        <Card>
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              {parsing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Parsing {fileName}...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports Word (.docx), PDF, Text (.txt), JSON</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parsed Results */}
        {parsedCases.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Parsed Test Cases</CardTitle>
                  <CardDescription>{parsedCases.length} test case(s) found in {fileName}</CardDescription>
                </div>
                <Button onClick={handleSaveSelected} disabled={saving || selected.size === 0}>
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
                        checked={selected.size === parsedCases.length}
                        onCheckedChange={() => {
                          if (selected.size === parsedCases.length) setSelected(new Set());
                          else setSelected(new Set(parsedCases.map((_, i) => i)));
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Steps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedCases.map((tc, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleSelect(i)} />
                      </TableCell>
                      <TableCell className="font-medium">{tc.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{tc.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tc.steps?.length || 0} steps</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
