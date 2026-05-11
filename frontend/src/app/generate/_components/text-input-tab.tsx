/**
 * "Natural Language" tab content for the generate page.
 *
 * Lets the user describe what they want to test in free text,
 * optionally specify a target URL, and trigger AI generation.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { inferUrlFromText } from "../_lib/url-utils";

interface TextInputTabProps {
  /** Current description text. */
  textInput: string;
  /** Target URL for scraping context. */
  targetUrl: string;
  /** Whether generation is in progress. */
  generating: boolean;
  /** Whether page scraping is in progress. */
  scraping: boolean;
  onTextChange: (value: string) => void;
  onTargetUrlChange: (value: string) => void;
  onTargetUrlBlur: () => void;
  onGenerate: () => void;
}

/**
 * Renders the natural-language description textarea, target URL field,
 * and the generate button.
 *
 * @param props - Current values and event callbacks.
 */
export function TextInputTab({
  textInput, targetUrl, generating, scraping,
  onTextChange, onTargetUrlChange, onTargetUrlBlur, onGenerate,
}: TextInputTabProps) {
  return (
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
            onChange={(e) => onTextChange(e.target.value)}
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
              onChange={(e) => onTargetUrlChange(e.target.value)}
              onBlur={onTargetUrlBlur}
              placeholder="e.g., https://example.com/login"
              className="flex-1"
            />
            {textInput && !targetUrl && (
              <Button
                variant="outline"
                onClick={() => {
                  const inferred = inferUrlFromText(textInput);
                  if (inferred) {
                    onTargetUrlChange(inferred);
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
          <Button onClick={onGenerate} disabled={generating || scraping || !textInput.trim()}>
            {generating || scraping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {scraping ? "Scraping Page..." : "Generate Test Cases"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
