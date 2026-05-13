/**
 * Extension Setup page.
 *
 * A step-by-step wizard that guides users through downloading,
 * loading, and configuring the browser extension (FR-8).
 *
 * Steps:
 * 1. Download Extension
 * 2. Load Extension in Browser
 * 3. Copy Extension ID
 * 4. Configure & Test Connection
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Puzzle,
  Copy,
  Plug,
  CheckCircle2,
  Circle,
  Loader2,
  ExternalLink,
  ArrowRight,
  SkipForward,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { getExtensionId, setExtensionId, pingExtension } from "@/lib/extension";

type StepStatus = "pending" | "active" | "complete";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { number: 1, title: "Download Extension", description: "Get the extension package", icon: Download },
  { number: 2, title: "Load in Browser", description: "Install via developer mode", icon: Globe },
  { number: 3, title: "Copy Extension ID", description: "Find your extension ID", icon: Copy },
  { number: 4, title: "Configure & Test", description: "Connect to QA Agent", icon: Plug },
];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [extensionId, setExtensionIdState] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "checking" | "connected" | "failed">("idle");

  useEffect(() => {
    const id = getExtensionId();
    if (id) {
      setExtensionIdState(id);
      // If already configured, mark steps 1-3 as complete
      setCompletedSteps(new Set([1, 2, 3]));
      setCurrentStep(4);
    }
  }, []);

  function getStepStatus(stepNumber: number): StepStatus {
    if (completedSteps.has(stepNumber)) return "complete";
    if (stepNumber === currentStep) return "active";
    return "pending";
  }

  function markComplete(stepNumber: number) {
    setCompletedSteps((prev) => new Set([...prev, stepNumber]));
    if (stepNumber < 4) setCurrentStep(stepNumber + 1);
  }

  function handleSaveExtensionId() {
    const trimmed = extensionId.trim();
    if (!trimmed) {
      toast.error("Please enter the extension ID");
      return;
    }
    setExtensionId(trimmed);
    toast.success("Extension ID saved");
  }

  async function handleTestConnection() {
    const trimmed = extensionId.trim();
    if (!trimmed) {
      toast.error("Please enter and save the extension ID first");
      return;
    }
    setConnectionStatus("checking");
    const ok = await pingExtension(trimmed);
    setConnectionStatus(ok ? "connected" : "failed");
    if (ok) {
      toast.success("Extension connected successfully!");
      markComplete(4);
    } else {
      toast.error("Could not connect to extension. Make sure it is loaded and enabled.");
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Extension Setup"
          description="Follow these steps to install and connect the browser extension"
        />
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <SkipForward className="h-4 w-4" />
          Skip Setup
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const status = getStepStatus(step.number);
          return (
            <div key={step.number} className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(step.number)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === "complete"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : status === "active"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{step.title}</span>
                <span className="sm:hidden">{step.number}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="space-y-4">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Step 1: Download Extension
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The QA Agent browser extension enables automated test execution, element picking,
                and page scraping directly in your browser. Download the extension package to get started.
              </p>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="font-medium text-sm">What the extension does:</h4>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Executes test cases on live web applications</li>
                  <li>Provides an element picker for selecting CSS selectors visually</li>
                  <li>Scrapes page content to provide context for AI test generation</li>
                  <li>Shows execution progress in real-time via the popup</li>
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={() => window.open("/api/extension/download", "_blank")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Extension Package
                </Button>
                <span className="text-xs text-muted-foreground">
                  Compatible with Chrome and Edge (Manifest V3)
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                If you already have the extension folder (e.g. from the project repo under <code>/extension</code>),
                you can skip this step.
              </p>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => markComplete(1)}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Step 2: Load Extension in Browser
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Load the extension in your browser using Developer Mode. Follow these steps:
              </p>

              <ol className="space-y-4">
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">1</Badge>
                  <div>
                    <p className="text-sm font-medium">Open the Extensions page</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Navigate to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> in Chrome
                      or <code className="bg-muted px-1.5 py-0.5 rounded text-xs">edge://extensions</code> in Edge
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">2</Badge>
                  <div>
                    <p className="text-sm font-medium">Enable Developer Mode</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Toggle the <strong>&quot;Developer mode&quot;</strong> switch in the top-right corner of the extensions page
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">3</Badge>
                  <div>
                    <p className="text-sm font-medium">Click &quot;Load unpacked&quot;</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Click the <strong>&quot;Load unpacked&quot;</strong> button that appears in the top-left area
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">4</Badge>
                  <div>
                    <p className="text-sm font-medium">Select the extension folder</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Browse to and select the extracted extension folder (the one containing <code className="bg-muted px-1.5 py-0.5 rounded text-xs">manifest.json</code>)
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Badge variant="outline" className="h-6 w-6 shrink-0 items-center justify-center rounded-full p-0">5</Badge>
                  <div>
                    <p className="text-sm font-medium">Verify it&apos;s loaded</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      The extension should now appear in your extensions list with the name <strong>&quot;QA Agent&quot;</strong>.
                      Make sure the toggle is <strong>enabled</strong> (blue).
                    </p>
                  </div>
                </li>
              </ol>

              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                <strong>Tip:</strong> If you extracted the extension from a ZIP file, make sure to select the inner folder
                that contains <code>manifest.json</code>, not the outer ZIP folder.
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>Back</Button>
                <Button variant="outline" onClick={() => markComplete(2)}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Step 3: Copy Extension ID
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Now you need to copy the extension&apos;s unique ID so QA Agent can communicate with it.
              </p>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="font-medium text-sm">How to find the Extension ID:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>
                    On the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">chrome://extensions</code> page,
                    make sure <strong>Developer mode</strong> is enabled
                  </li>
                  <li>
                    Find the <strong>&quot;QA Agent&quot;</strong> extension card
                  </li>
                  <li>
                    The <strong>ID</strong> is displayed below the extension name — it looks like a long string of lowercase letters,
                    e.g. <code className="bg-muted px-1.5 py-0.5 rounded text-xs">abcdefghijklmnopqrstuvwxyz012345</code>
                  </li>
                  <li>
                    Click the ID or select it and copy (<kbd className="bg-muted px-1 py-0.5 rounded text-xs">Ctrl+C</kbd>)
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border p-4 bg-muted/10">
                <div className="flex items-start gap-3">
                  <Puzzle className="h-10 w-10 text-muted-foreground shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">QA Agent</p>
                    <p className="text-xs text-muted-foreground">Automated QA testing browser extension</p>
                    <p className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded inline-block mt-1">
                      ID: abcdefghijklmnop... ← Copy this value
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(2)}>Back</Button>
                <Button variant="outline" onClick={() => markComplete(3)}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Step 4: Configure & Test Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paste the extension ID below and test the connection to verify everything is working.
              </p>

              <div className="space-y-2">
                <Label htmlFor="ext-id">Extension ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="ext-id"
                    placeholder="e.g. abcdefghijklmnopqrstuvwxyz012345"
                    value={extensionId}
                    onChange={(e) => setExtensionIdState(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleSaveExtensionId} variant="outline">
                    Save
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleTestConnection} disabled={connectionStatus === "checking"}>
                  {connectionStatus === "checking" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plug className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>

                {connectionStatus === "connected" && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                )}
                {connectionStatus === "failed" && (
                  <Badge variant="destructive">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Not connected
                  </Badge>
                )}
              </div>

              {connectionStatus === "connected" && (
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 space-y-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    🎉 Setup Complete!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your browser extension is connected and ready. You can now:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Link href="/generate" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">Generate Tests with AI</Link>
                    <Link href="/test-cases" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">View Test Cases</Link>
                    <Link href="/projects" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">Browse Projects</Link>
                  </div>
                </div>
              )}

              {connectionStatus === "failed" && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Troubleshooting:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Make sure the extension is loaded and enabled in your browser</li>
                    <li>Verify the extension ID is correct (no extra spaces)</li>
                    <li>Try reloading the extension on the <code>chrome://extensions</code> page</li>
                    <li>Ensure you&apos;re using Chrome or Edge</li>
                  </ul>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setCurrentStep(3)}>Back</Button>
                {connectionStatus !== "connected" && (
                  <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    Skip to Settings
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
