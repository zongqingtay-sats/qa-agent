/**
 * AI test-case generation page.
 *
 * Orchestrates three input methods (natural language, document upload,
 * source code upload) and displays generated results in a selectable
 * table.  Handles scraping, generation, refinement, and persistence.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Code } from "lucide-react";
import { toast } from "sonner";

import { generateApi, importApi, testCasesApi } from "@/lib/api";
import type { GeneratedTestCase } from "@/types/api";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";
import { buildFlowFromSteps } from "@/lib/flow-utils";
import { inferUrlFromText, formatUrl } from "./_lib/url-utils";
import { refineWithNavigationPages } from "./_lib/generation-handlers";
import { TextInputTab } from "./_components/text-input-tab";
import { DocumentTab } from "./_components/document-tab";
import { SourceTab } from "./_components/source-tab";
import { GenerationResultsTable } from "./_components/generation-results-table";

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const featureId = searchParams.get("featureId") || undefined;
  const phaseId = searchParams.get("phaseId") || undefined;

  const [generating, setGenerating] = useState(false);
  const [generatedCases, setGeneratedCases] = useState<GeneratedTestCase[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [scraping, setScraping] = useState(false);

  // ── URL auto-inference (debounced) ──

  const inferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Update text and schedule a URL inference if none set yet. */
  function handleTextChange(value: string) {
    setTextInput(value);
    if (inferTimerRef.current) clearTimeout(inferTimerRef.current);
    inferTimerRef.current = setTimeout(() => {
      if (!targetUrl) {
        const inferred = inferUrlFromText(value);
        if (inferred) setTargetUrl(inferred);
      }
    }, 600);
  }

  useEffect(() => () => { if (inferTimerRef.current) clearTimeout(inferTimerRef.current); }, []);

  /** Normalise the URL field on blur. */
  function handleFormatUrl() {
    setTargetUrl((prev) => formatUrl(prev));
  }

  // ── Generation handlers ──

  /** Generate from natural language description. */
  async function handleGenerateFromText() {
    if (!textInput.trim()) { toast.error("Please enter a description"); return; }
    setGenerating(true);
    setGeneratedCases([]);

    let pageHtml: string | undefined;

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
        toast.info("No extension configured — set extension ID in Settings for better accuracy.");
      }
    }

    try {
      const res = await generateApi.fromText(textInput, { targetUrl: targetUrl.trim() || undefined, pageHtml });
      let cases = res.data.testCases || [];
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: GeneratedTestCase, i: number) => i)));
      toast.success(`Generated ${cases.length} test case(s)`);

      if (targetUrl.trim()) {
        const refined = await refineWithNavigationPages(cases, targetUrl.trim(), setScraping);
        if (refined !== cases) {
          setGeneratedCases(refined);
          setSelected(new Set(refined.map((_: GeneratedTestCase, i: number) => i)));
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  /** Generate from an uploaded document. */
  const onDocumentDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setGenerating(true);
    setGeneratedCases([]);
    try {
      const file = files[0];
      const isJson = file.name.toLowerCase().endsWith(".json");
      const cases = isJson
        ? (await importApi.parse(file)).data.testCases || []
        : (await generateApi.fromRequirements(file)).data.testCases || [];
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: GeneratedTestCase, i: number) => i)));
      toast.success(`${isJson ? "Imported" : "Generated"} ${cases.length} test case(s) from ${file.name}`);
    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  }, []);

  /** Generate from uploaded source code files. */
  const onSourceDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setGenerating(true);
    setGeneratedCases([]);
    try {
      const cases = (await generateApi.fromSource(files)).data.testCases || [];
      setGeneratedCases(cases);
      setSelected(new Set(cases.map((_: GeneratedTestCase, i: number) => i)));
      toast.success(`Generated ${cases.length} test case(s) from ${files.length} file(s)`);    } catch (err: any) { toast.error(err.message); }
    finally { setGenerating(false); }
  }, []);

  // ── Dropzone state ──

  const [lastDocFile, setLastDocFile] = useState<File | null>(null);
  const [lastSrcFiles, setLastSrcFiles] = useState<File[] | null>(null);

  const reqDropzone = useDropzone({
    onDrop: (files) => setLastDocFile(files[0] || null),
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"], "text/plain": [".txt"], "application/json": [".json"],
    },
    maxFiles: 1, maxSize: 20 * 1024 * 1024,
  });

  const srcDropzone = useDropzone({
    onDrop: (files) => setLastSrcFiles(files.length > 0 ? files : null),
    maxSize: 20 * 1024 * 1024,
  });

  // ── Save selected cases ──

  async function handleSaveSelected() {
    setSaving(true);
    try {
      const toSave = generatedCases.filter((_, i) => selected.has(i));
      for (const tc of toSave) {
        const steps = tc.steps || [];
        if (steps.length === 0 || steps[0].action !== "navigate") {
          steps.unshift({ order: 0, action: "navigate", target: targetUrl.trim() || "/", description: `Navigate to ${targetUrl.trim() || "target URL"}` });
        } else if (steps[0].action === "navigate" && !steps[0].target && targetUrl.trim()) {
          steps[0].target = targetUrl.trim();
        }
        const { nodes, edges } = buildFlowFromSteps(steps);
        await testCasesApi.create({
          name: tc.name, description: tc.description || "", preconditions: tc.preconditions, passingCriteria: tc.passingCriteria, tags: [], flowData: { nodes, edges },
          projectId,
          featureIds: featureId ? [featureId] : undefined,
          phaseIds: phaseId ? [phaseId] : undefined,
        });
      }
      toast.success(`Saved ${toSave.length} test case(s)`);
      router.push(projectId ? `/projects/${projectId}` : "/test-cases");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  // ── Selection helpers ──

  function toggleSelection(i: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  function toggleSelectAll() {
    setSelected(selected.size === generatedCases.length ? new Set() : new Set(generatedCases.map((_, i) => i)));
  }

  return (
    <>
      <PageHeader title="Generate Test Cases" icon={<Sparkles className="h-5 w-5" />} />
      <div className="p-4 max-w-4xl">
        <Tabs defaultValue="text">
          <TabsList className="mb-2">
            <TabsTrigger value="text"><Sparkles className="h-4 w-4 mr-1" /> Natural Language</TabsTrigger>
            <TabsTrigger value="requirements"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
            <TabsTrigger value="source"><Code className="h-4 w-4 mr-1" /> Source Code</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <TextInputTab textInput={textInput} targetUrl={targetUrl} generating={generating} scraping={scraping} onTextChange={handleTextChange} onTargetUrlChange={setTargetUrl} onTargetUrlBlur={handleFormatUrl} onGenerate={handleGenerateFromText} />
          </TabsContent>
          <TabsContent value="requirements">
            <DocumentTab dropzone={reqDropzone} lastFile={lastDocFile} targetUrl={targetUrl} generating={generating} onTargetUrlChange={setTargetUrl} onTargetUrlBlur={handleFormatUrl} onGenerate={() => lastDocFile && onDocumentDrop([lastDocFile])} />
          </TabsContent>
          <TabsContent value="source">
            <SourceTab dropzone={srcDropzone} lastFiles={lastSrcFiles} targetUrl={targetUrl} generating={generating} onTargetUrlChange={setTargetUrl} onTargetUrlBlur={handleFormatUrl} onGenerate={() => lastSrcFiles && onSourceDrop(lastSrcFiles)} />
          </TabsContent>
        </Tabs>
        <GenerationResultsTable cases={generatedCases} selected={selected} onToggle={toggleSelection} onToggleAll={toggleSelectAll} saving={saving} onSave={handleSaveSelected} />
      </div>
    </>
  );
}
