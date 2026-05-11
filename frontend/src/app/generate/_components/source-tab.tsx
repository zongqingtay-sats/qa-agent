/**
 * "Source Code" tab content for the generate page.
 *
 * Accepts source code files via drag-and-drop and sends them to the
 * AI generation endpoint, with an optional target URL.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Code, Globe, Loader2, Sparkles } from "lucide-react";
import type { DropzoneState } from "react-dropzone";

interface SourceTabProps {
  /** Dropzone state returned by `useDropzone`. */
  dropzone: DropzoneState;
  /** The most recently uploaded files, if any. */
  lastFiles: File[] | null;
  /** Target URL for optional page scraping. */
  targetUrl: string;
  /** Whether generation is in progress. */
  generating: boolean;
  onTargetUrlChange: (v: string) => void;
  onTargetUrlBlur: () => void;
  onGenerate: () => void;
}

/**
 * Renders the source-code drop zone, target URL field, and generate button.
 *
 * @param props - Dropzone state, current values, and callbacks.
 */
export function SourceTab({
  dropzone, lastFiles, targetUrl, generating,
  onTargetUrlChange, onTargetUrlBlur, onGenerate,
}: SourceTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Source Code</CardTitle>
        <CardDescription>Upload source code files and AI will analyze them to generate relevant test cases</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...dropzone.getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
            dropzone.isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <input {...dropzone.getInputProps()} />
          {generating ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing source code...</p>
            </div>
          ) : lastFiles && lastFiles.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <Code className="h-10 w-10 text-primary" />
              <p className="text-sm font-medium">
                {lastFiles.length} file(s): {lastFiles.map((f) => f.name).join(", ")}
              </p>
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
            onChange={(e) => onTargetUrlChange(e.target.value)}
            onBlur={onTargetUrlBlur}
            placeholder="e.g., https://example.com/login"
          />
          <p className="text-xs text-muted-foreground">The entry point URL of the application to test.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onGenerate} disabled={generating || !lastFiles}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Test Cases
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
