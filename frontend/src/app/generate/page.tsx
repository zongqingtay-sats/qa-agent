"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Upload, FileText, Code, Loader2, Check, Globe, Wand2 } from "lucide-react";
import { generateApi, importApi, testCasesApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";
import { toast } from "sonner";

export default function GeneratePage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  // Try to infer a URL from the natural language input
  function inferUrlFromText(text: string): string {
    const urlMatch = text.match(/https?:\/\/[^\s,)]+/i);
    if (urlMatch) return urlMatch[0];
    const domainMatch = text.match(/(?:^|\s)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?)/i);
    if (domainMatch) return `https://${domainMatch[1]}`;
    const localhostMatch = text.match(/localhost(?::(\d+))?(?:\/[^\s,)]*)?/i);
    if (localhostMatch) return `http://${localhostMatch[0]}`;
    return "";
  }

  // Auto-infer URL when text changes
  function handleTextChange(value: string) {
    setTextInput(value);
    if (!targetUrl) {
      const inferred = inferUrlFromText(value);
      if (inferred) setTargetUrl(inferred);
    }
  }

  // After initial generation, find navigation targets and refine with scraped HTML
  async function refineWithNavigationPages(cases: any[], baseUrl?: string) {
    const extensionId = getExtensionId();
    if (!extensionId) return cases;

    // Collect unique URLs from navigate actions and url-matches assertions
    const navUrls = new Set<string>();
    for (const tc of cases) {
      for (const step of tc.steps || []) {
        if (step.action === "navigate" && step.target) {
          try {
            const url = new URL(step.target, baseUrl || undefined).href;
            navUrls.add(url);
          } catch { /* relative path without base, skip */ }
        }
        // Also look for click steps whose description hints at navigation
        if (step.action === "click" && step.description && /navigate|redirect|go to|open|link/i.test(step.description) && step.target) {
          // We can't know the destination URL from a click, but we'll catch it via navigate steps
        }
      }
    }

    // Remove the initial URL (already scraped)
    if (baseUrl) navUrls.delete(baseUrl);

    if (navUrls.size === 0) return cases;

    toast.info(`Scraping ${navUrls.size} additional page(s) for refinement...`);
    setScraping(true);

    const pageContexts: { url: string; html: string }[] = [];
    for (const url of navUrls) {
      try {
        const result = await scrapePageViaExtension(extensionId, url);
        if (result.html) {
          pageContexts.push({ url, html: result.html });
        }
      } catch { /* skip failed scrapes */ }
    }

    setScraping(false);

    if (pageContexts.length === 0) return cases;

    toast.info(`Refining test cases with ${pageContexts.length} additional page(s)...`);
    try {
      const res = await generateApi.refine(cases, pageContexts, baseUrl);
      const refined = res.data.testCases || cases;
      toast.success(`Refined test cases with ${pageContexts.length} additional page context(s)`);
      return refined;
    } catch {
      toast.warning("Refinement failed — using initial test cases");
      return cases;
    }
  }

  // Generate from natural language
  async function handleGenerateFromText() {
    if (!textInput.trim()) {
      toast.error("Please enter a description");
      return;
    }
    setGenerating(true);
    setGeneratedCases([]);

    let pageHtml: string | undefined;

    // If a target URL is provided, try to scrape the page via extension
    if (targetUrl.trim()) {
      const extensionId = getExtensionId();
      if (extensionId) {
        setScraping(true);
        toast.info("Scraping target page for context...");
        try {
          const scrapeResult = await scrapePageViaExtension(extensionId, targetUrl.trim());
          if (scrapeResult.html) {
            pageHtml = scrapeResult.html;
            toast.success("Page scraped — using page structure for better accuracy");
          } else if (scrapeResult.error) {
            toast.warning(`Could not scrape page: ${scrapeResult.error}. Generating without page context.`);
          }
        } catch {
          toast.warning("Page scraping failed. Generating without page context.");
        }
        setScraping(false);
      } else {
        toast.info("No extension configured — generating without page context. Set extension ID in Settings for better accuracy.");
      }
    }

    try {
      const res = await generateApi.fromText(textInput, {
        targetUrl: targetUrl.trim() || undefined,
        pageHtml,
      });
      let cases = res.data.testCases || [];
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: any, i: number) => i)));
      toast.success(`Generated ${cases.length} test case(s)`);

      // Refine with additional page scrapes if navigation steps are detected
      if (targetUrl.trim()) {
        const refined = await refineWithNavigationPages(cases, targetUrl.trim());
        if (refined !== cases) {
          setGeneratedCases(refined);
          setSelected(new Set(refined.map((_: any, i: number) => i)));
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  // Generate from requirements file or import test case document (auto-detected)
  const onDocumentDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setGenerating(true);
    setGeneratedCases([]);
    try {
      const file = files[0];
      const isJson = file.name.toLowerCase().endsWith(".json");
      let cases: any[];

      if (isJson) {
        // JSON files are treated as test case imports
        const res = await importApi.parse(file);
        cases = res.data.testCases || [];
        toast.success(`Imported ${cases.length} test case(s) from ${file.name}`);
      } else {
        // All other files — let AI decide if it's requirements or existing test cases
        const res = await generateApi.fromRequirements(file);
        cases = res.data.testCases || [];
        toast.success(`Generated ${cases.length} test case(s) from ${file.name}`);
      }
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: any, i: number) => i)));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }, []);

  // Generate from source code
  const onSourceDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setGenerating(true);
    setGeneratedCases([]);
    try {
      const res = await generateApi.fromSource(files);
      const cases = res.data.testCases || [];
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: any, i: number) => i)));
      toast.success(`Generated ${cases.length} test case(s) from ${files.length} file(s)`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }, []);


  // Track last uploaded file for each tab
  const [lastDocFile, setLastDocFile] = useState<File | null>(null);
  const [lastSrcFiles, setLastSrcFiles] = useState<File[] | null>(null);

  const reqDropzone = useDropzone({
    onDrop: (files) => {
      setLastDocFile(files[0] || null);
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  const srcDropzone = useDropzone({
    onDrop: (files) => {
      setLastSrcFiles(files.length > 0 ? files : null);
    },
    maxSize: 20 * 1024 * 1024,
  });

  function handleGenerateFromDocumentButton() {
    if (lastDocFile) {
      onDocumentDrop([lastDocFile]);
    }
  }
  function handleGenerateFromSourceButton() {
    if (lastSrcFiles && lastSrcFiles.length > 0) {
      onSourceDrop(lastSrcFiles);
    }
  }

  async function handleSaveSelected() {
    setSaving(true);
    try {
      const toSave = generatedCases.filter((_, i) => selected.has(i));
      for (const tc of toSave) {
        const nodes: any[] = [
          { id: "start-1", type: "startNode", position: { x: 250, y: 0 }, data: { label: "Start", blockType: "start", baseUrl: targetUrl.trim() || undefined } },
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
          position: { x: 250, y: nodes.length * 120 },
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
          tags: [],
          flowData: { nodes, edges },
        });
      }

      toast.success(`Saved ${toSave.length} test case(s)`);
      router.push("/test-cases");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Generate Test Cases with AI" description="Use AI to create test cases from requirements, descriptions, or source code" />
      <div className="flex-1 p-4 space-y-6 max-w-4xl">
        <Tabs defaultValue="text">
          <TabsList>
            <TabsTrigger value="text"><Sparkles className="h-4 w-4 mr-1" /> Natural Language</TabsTrigger>
            <TabsTrigger value="requirements"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
            <TabsTrigger value="source"><Code className="h-4 w-4 mr-1" /> Source Code</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle>Describe What to Test</CardTitle>
                <CardDescription>Write a description of the features or scenarios you want to test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-input">Description</Label>
                  <Textarea
                    id="text-input"
                    value={textInput}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="e.g., Test the login page at https://myapp.com/login. Users should be able to log in with email and password. Invalid credentials should show an error message..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-url" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Test Target URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="target-url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="e.g., https://example.com/login"
                      className="flex-1"
                    />
                    {textInput && !targetUrl && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const inferred = inferUrlFromText(textInput);
                          if (inferred) {
                            setTargetUrl(inferred);
                            toast.info(`Inferred URL: ${inferred}`);
                          } else {
                            toast.warning("Could not infer a URL from the description");
                          }
                        }}
                      >
                        <Wand2 className="h-3.5 w-3.5 mr-1" /> Infer
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The entry point URL of the application to test. The extension will scrape this page to generate more accurate selectors and interactions.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGenerateFromText} disabled={generating || scraping || !textInput.trim()}>
                    {generating || scraping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    {scraping ? "Scraping Page..." : "Generate Test Cases"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements">
            <Card>
              <CardHeader>
                <CardTitle>Upload a Document</CardTitle>
                <CardDescription>Upload requirements docs, test case documents, or JSON files — AI will automatically detect the type and generate or import test cases</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...reqDropzone.getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${reqDropzone.isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                >
                  <input {...reqDropzone.getInputProps()} />
                  {generating ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Processing document...</p>
                    </div>
                  ) : lastDocFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-primary" />
                      <p className="text-sm font-medium">{lastDocFile.name}</p>
                      <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">Drop a file here or click to browse</p>
                      <p className="text-xs text-muted-foreground">Word, PDF, Text, or JSON files</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-url-req" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Test Target URL
                  </Label>
                  <Input
                    id="target-url-req"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="e.g., https://example.com/login"
                  />
                  <p className="text-xs text-muted-foreground">
                    The entry point URL of the application to test.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGenerateFromDocumentButton} disabled={generating || !lastDocFile}>
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate Test Cases
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="source">
            <Card>
              <CardHeader>
                <CardTitle>Upload Source Code</CardTitle>
                <CardDescription>Upload source code files and AI will analyze them to generate relevant test cases</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...srcDropzone.getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${srcDropzone.isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                >
                  <input {...srcDropzone.getInputProps()} />
                  {generating ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">Analyzing source code...</p>
                    </div>
                  ) : lastSrcFiles && lastSrcFiles.length > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <Code className="h-10 w-10 text-primary" />
                      <p className="text-sm font-medium">{lastSrcFiles.length} file(s): {lastSrcFiles.map(f => f.name).join(", ")}</p>
                      <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Code className="h-10 w-10 text-muted-foreground" />
                      <p className="text-sm font-medium">Upload source code files</p>
                      <p className="text-xs text-muted-foreground">TypeScript, JavaScript, React, Vue, Python, etc.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-url-src" className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Test Target URL
                  </Label>
                  <Input
                    id="target-url-src"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="e.g., https://example.com/login"
                  />
                  <p className="text-xs text-muted-foreground">
                    The entry point URL of the application to test.
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGenerateFromSourceButton} disabled={generating || !lastSrcFiles}>
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate Test Cases
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generated Results */}
        {generatedCases.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Test Cases</CardTitle>
                  <CardDescription>{generatedCases.length} test case(s) generated</CardDescription>
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
                        checked={selected.size === generatedCases.length}
                        onCheckedChange={() => {
                          if (selected.size === generatedCases.length) setSelected(new Set());
                          else setSelected(new Set(generatedCases.map((_, i) => i)));
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Steps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generatedCases.map((tc, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox checked={selected.has(i)} onCheckedChange={() => {
                          setSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          });
                        }} />
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
