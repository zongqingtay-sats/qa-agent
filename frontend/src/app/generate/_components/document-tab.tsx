/**
 * "Documents" tab content for the generate page.
 *
 * Accepts a requirements document (Word, PDF, TXT, or JSON) via
 * drag-and-drop, with an optional target URL for page scraping.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Globe, Loader2, Sparkles, Upload } from "lucide-react";
import type { DropzoneState } from "react-dropzone";

interface DocumentTabProps {
  /** Dropzone state returned by `useDropzone`. */
  dropzone: DropzoneState;
  /** The most recently uploaded file, if any. */
  lastFile: File | null;
  /** Target URL for optional page scraping. */
  targetUrl: string;
  /** Whether generation is in progress. */
  generating: boolean;
  onTargetUrlChange: (v: string) => void;
  onTargetUrlBlur: () => void;
  onGenerate: () => void;
}

/**
 * Renders the document drop zone, target URL field, and generate button.
 *
 * @param props - Dropzone state, current values, and callbacks.
 */
export function DocumentTab({
  dropzone, lastFile, targetUrl, generating,
  onTargetUrlChange, onTargetUrlBlur, onGenerate,
}: DocumentTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a Document</CardTitle>
        <CardDescription>
          Upload requirements docs, test case documents, or JSON files — AI will automatically detect the type and generate or import test cases
        </CardDescription>
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
              <p className="text-sm text-muted-foreground">Processing document...</p>
            </div>
          ) : lastFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-primary" />
              <p className="text-sm font-medium">{lastFile.name}</p>
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
            onChange={(e) => onTargetUrlChange(e.target.value)}
            onBlur={onTargetUrlBlur}
            placeholder="e.g., https://example.com/login"
          />
          <p className="text-xs text-muted-foreground">The entry point URL of the application to test.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onGenerate} disabled={generating || !lastFile}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Test Cases
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
