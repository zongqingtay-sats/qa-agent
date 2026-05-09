"use client";

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type Node,
  type Edge,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Save,
  Play,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  MousePointerClick,
  Type,
  Globe,
  Eye,
  Clock,
  GitBranch,
  Camera,
  ChevronDown,
  CircleDot,
  CircleStop,
  Hand,
  ArrowDownUp,
  ListChecks,
  Sparkles,
  Loader2,
} from "lucide-react";
import { testCasesApi, exportApi, generateApi } from "@/lib/api";
import { runTestCase } from "@/lib/run-test";
import { getExtensionId, scrapePageViaExtension } from "@/lib/extension";

// ---- Block Type Configuration ----

const BLOCK_TYPES = [
  { type: "start", label: "Start", icon: CircleDot, category: "Control", color: "bg-green-100 border-green-400 text-green-800" },
  { type: "end", label: "End", icon: CircleStop, category: "Control", color: "bg-red-100 border-red-400 text-red-800" },
  { type: "navigate", label: "Navigate", icon: Globe, category: "Action", color: "bg-blue-100 border-blue-400 text-blue-800" },
  { type: "click", label: "Click", icon: MousePointerClick, category: "Action", color: "bg-purple-100 border-purple-400 text-purple-800" },
  { type: "type", label: "Type", icon: Type, category: "Action", color: "bg-orange-100 border-orange-400 text-orange-800" },
  { type: "select", label: "Select", icon: ChevronDown, category: "Action", color: "bg-indigo-100 border-indigo-400 text-indigo-800" },
  { type: "hover", label: "Hover", icon: Hand, category: "Action", color: "bg-pink-100 border-pink-400 text-pink-800" },
  { type: "scroll", label: "Scroll", icon: ArrowDownUp, category: "Action", color: "bg-cyan-100 border-cyan-400 text-cyan-800" },
  { type: "wait", label: "Wait", icon: Clock, category: "Action", color: "bg-yellow-100 border-yellow-400 text-yellow-800" },
  { type: "assert", label: "Assert", icon: CheckCircle, category: "Validation", color: "bg-emerald-100 border-emerald-400 text-emerald-800" },
  { type: "if-else", label: "If-Else", icon: GitBranch, category: "Control", color: "bg-amber-100 border-amber-400 text-amber-800" },
  { type: "screenshot", label: "Screenshot", icon: Camera, category: "Capture", color: "bg-slate-100 border-slate-400 text-slate-800" },
];

function getBlockConfig(blockType: string) {
  return BLOCK_TYPES.find(b => b.type === blockType);
}

// ---- Custom Node Component ----

function FlowBlockNode({ data, selected }: { data: any; selected: boolean }) {
  const config = getBlockConfig(data.blockType);
  if (!config) return null;

  const Icon = config.icon;
  const executionStatusClass =
    data.executionStatus === 'passed' ? 'ring-2 ring-green-500' :
    data.executionStatus === 'failed' ? 'ring-2 ring-red-500' :
    data.executionStatus === 'running' ? 'ring-2 ring-blue-500 animate-pulse' : '';

  const isStart = data.blockType === 'start';
  const isEnd = data.blockType === 'end';

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 min-w-[160px] shadow-sm ${config.color} ${selected ? "ring-2 ring-primary" : ""} ${executionStatusClass} relative`}
    >
      {/* Target handle (top) - all blocks except Start */}
      {!isStart && (
        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      )}

      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{data.label || config.label}</span>
      </div>
      {data.description && (
        <p className="text-xs mt-1 opacity-70 truncate">{data.description}</p>
      )}
      {data.selector && (
        <p className="text-xs mt-1 font-mono opacity-60 truncate">{data.selector}</p>
      )}

      {/* Source handle (bottom) - all blocks except End and If-Else */}
      {!isEnd && data.blockType !== 'if-else' && (
        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
      )}

      {/* If-Else: two labeled source handles */}
      {data.blockType === 'if-else' && (
        <>
          <div className="flex justify-between mt-2 text-[10px] font-semibold">
            <span className="text-green-700">Then</span>
            <span className="text-red-700">Else</span>
          </div>
          <Handle
            type="source"
            position={Position.Bottom}
            id="then"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
            style={{ left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="else"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
            style={{ left: '70%' }}
          />
        </>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  startNode: FlowBlockNode,
  endNode: FlowBlockNode,
  actionNode: FlowBlockNode,
  assertNode: FlowBlockNode,
  conditionNode: FlowBlockNode,
  captureNode: FlowBlockNode,
};

function blockTypeToNodeType(blockType: string): string {
  switch (blockType) {
    case 'start': return 'startNode';
    case 'end': return 'endNode';
    case 'assert': return 'assertNode';
    case 'if-else': return 'conditionNode';
    case 'screenshot': return 'captureNode';
    default: return 'actionNode';
  }
}

// ---- Block Properties Panel ----

function BlockPropertiesPanel({
  node,
  onUpdate,
  onDelete,
}: {
  node: Node | null;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="w-72 border-l bg-muted/30 p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">Select a block to edit its properties</p>
      </div>
    );
  }

  const data = node.data as any;
  const blockType = data.blockType;

  function update(field: string, value: any) {
    onUpdate(node!.id, { ...data, [field]: value });
  }

  return (
    <ScrollArea className="w-72 border-l bg-muted/30">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {(() => {
              const config = getBlockConfig(blockType);
              if (!config) return null;
              const Icon = config.icon;
              return <Icon className="h-4 w-4" />;
            })()}
            {getBlockConfig(blockType)?.label || blockType} Block
          </h3>
          <Badge variant="outline" className="mt-1">{blockType}</Badge>
        </div>

        <Separator />

        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={data.label || ""} onChange={(e) => update("label", e.target.value)} placeholder="Block label" />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Textarea value={data.description || ""} onChange={(e) => update("description", e.target.value)} placeholder="What does this step do?" rows={2} />
        </div>

        <Separator />

        {/* Type-specific fields */}
        {blockType === "start" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL</Label>
            <Input value={data.baseUrl || ""} onChange={(e) => update("baseUrl", e.target.value)} placeholder="https://example.com" />
          </div>
        )}

        {blockType === "navigate" && (
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input value={data.url || ""} onChange={(e) => update("url", e.target.value)} placeholder="/page or https://..." />
          </div>
        )}

        {(blockType === "click" || blockType === "type" || blockType === "select" || blockType === "hover" || blockType === "scroll") && (
          <div className="space-y-1.5">
            <Label className="text-xs">CSS Selector</Label>
            <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder='button.submit, #login-form, [data-testid="..."]' className="font-mono text-xs" />
          </div>
        )}

        {blockType === "click" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Click Type</Label>
            <Select value={data.clickType || "single"} onValueChange={(v) => update("clickType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Click</SelectItem>
                <SelectItem value="double">Double Click</SelectItem>
                <SelectItem value="right">Right Click</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {blockType === "type" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Text Value</Label>
              <Input value={data.value || ""} onChange={(e) => update("value", e.target.value)} placeholder="Text to type" />
            </div>
          </>
        )}

        {blockType === "select" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Option Value</Label>
            <Input value={data.selectValue || ""} onChange={(e) => update("selectValue", e.target.value)} placeholder="Option value or label" />
          </div>
        )}

        {blockType === "scroll" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <Select value={data.scrollDirection || "down"} onValueChange={(v) => update("scrollDirection", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Distance (px)</Label>
              <Input type="number" value={data.scrollDistance || 300} onChange={(e) => update("scrollDistance", Number(e.target.value))} />
            </div>
          </>
        )}

        {blockType === "wait" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Wait Type</Label>
              <Select value={data.waitType || "time"} onValueChange={(v) => update("waitType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Fixed Time</SelectItem>
                  <SelectItem value="element-visible">Element Visible</SelectItem>
                  <SelectItem value="element-hidden">Element Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(data.waitType === "element-visible" || data.waitType === "element-hidden") && (
              <div className="space-y-1.5">
                <Label className="text-xs">CSS Selector</Label>
                <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder="Element selector" className="font-mono text-xs" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Timeout (ms)</Label>
              <Input type="number" value={data.timeout || 3000} onChange={(e) => update("timeout", Number(e.target.value))} />
            </div>
          </>
        )}

        {blockType === "assert" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">CSS Selector</Label>
              <Input value={data.selector || ""} onChange={(e) => update("selector", e.target.value)} placeholder="Element to assert on" className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assertion Type</Label>
              <Select value={data.assertionType || "element-exists"} onValueChange={(v) => update("assertionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="element-exists">Element Exists</SelectItem>
                  <SelectItem value="element-not-exists">Element Not Exists</SelectItem>
                  <SelectItem value="element-visible">Element Visible</SelectItem>
                  <SelectItem value="text-contains">Text Contains</SelectItem>
                  <SelectItem value="value-equals">Value Equals</SelectItem>
                  <SelectItem value="url-matches">URL Matches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expected Value</Label>
              <Input value={data.expectedValue || ""} onChange={(e) => update("expectedValue", e.target.value)} placeholder="Expected value" />
            </div>
          </>
        )}

        {blockType === "if-else" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Selector</Label>
              <Input value={data.conditionSelector || ""} onChange={(e) => update("conditionSelector", e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Type</Label>
              <Select value={data.conditionType || "element-exists"} onValueChange={(v) => update("conditionType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="element-exists">Element Exists</SelectItem>
                  <SelectItem value="text-contains">Text Contains</SelectItem>
                  <SelectItem value="value-equals">Value Equals</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condition Value</Label>
              <Input value={data.conditionValue || ""} onChange={(e) => update("conditionValue", e.target.value)} />
            </div>
          </>
        )}

        {blockType === "screenshot" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Screenshot Label</Label>
            <Input value={data.screenshotLabel || ""} onChange={(e) => update("screenshotLabel", e.target.value)} placeholder="Label for this screenshot" />
          </div>
        )}

        {/* Passing Criteria (for all blocks except start/end) */}
        {blockType !== "start" && blockType !== "end" && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">Passing Criteria</Label>
              <Textarea value={data.passingCriteria || ""} onChange={(e) => update("passingCriteria", e.target.value)} placeholder="What determines if this step passes?" rows={2} />
            </div>
          </>
        )}

        <Separator />
        {blockType !== "start" && (
          <Button variant="destructive" size="sm" className="w-full" onClick={() => onDelete(node.id)}>
            Delete Block
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}

// ---- Block Palette ----

function BlockPalette() {
  const categories = ["Control", "Action", "Validation", "Capture"];

  function onDragStart(event: React.DragEvent, blockType: string) {
    event.dataTransfer.setData("application/reactflow-blocktype", blockType);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <ScrollArea className="w-56 border-r bg-muted/30">
      <div className="p-3 space-y-4">
        <h3 className="font-semibold text-sm px-1">Block Palette</h3>
        {categories.map((category) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground font-medium px-1 mb-2">{category}</p>
            <div className="space-y-1.5">
              {BLOCK_TYPES.filter(b => b.category === category).map((block) => {
                const Icon = block.icon;
                return (
                  <div
                    key={block.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, block.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab active:cursor-grabbing text-sm ${block.color} hover:opacity-80 transition-opacity`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{block.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ---- Flow Validation ----

function validateFlow(nodes: Node[], edges: Edge[]): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startNodes = nodes.filter(n => (n.data as any).blockType === "start");
  const endNodes = nodes.filter(n => (n.data as any).blockType === "end");

  if (startNodes.length === 0) errors.push("Flow must have a Start block");
  if (startNodes.length > 1) errors.push("Flow must have exactly one Start block");
  if (startNodes.length === 1 && !(startNodes[0].data as any).baseUrl) {
    errors.push("Start block must have a Target URL defined");
  }
  if (endNodes.length === 0) errors.push("Flow must have at least one End block");

  // Must have at least one assert block
  const assertNodes = nodes.filter(n => (n.data as any).blockType === "assert");
  if (assertNodes.length === 0) {
    errors.push("Flow must have at least one Assert block");
  }

  // Check connectivity
  if (startNodes.length === 1) {
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      edges.filter(e => e.source === current).forEach(e => queue.push(e.target));
    }

    const unreachable = nodes.filter(n => !reachable.has(n.id));
    if (unreachable.length > 0) {
      warnings.push(`${unreachable.length} block(s) are not reachable from Start`);
    }
  }

  // Check action blocks have selectors
  nodes.forEach(n => {
    const d = n.data as any;
    if (['click', 'type', 'select', 'hover'].includes(d.blockType) && !d.selector) {
      errors.push(`${d.label || d.blockType} block is missing a CSS selector`);
    }
    if (d.blockType === 'navigate' && !d.url) {
      errors.push(`${d.label || 'Navigate'} block is missing a URL`);
    }
    if (d.blockType === 'if-else') {
      if (!d.selector) {
        errors.push(`${d.label || 'If-Else'} block is missing a condition selector`);
      }
      const outgoing = edges.filter(e => e.source === n.id);
      if (outgoing.length < 2) {
        errors.push(`${d.label || 'If-Else'} block must have at least 1 outgoing branches (then or else)`);
      }
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ---- Main Editor ----

let nodeIdCounter = 0;

function FlowEditorInner() {
  const params = useParams();
  const router = useRouter();
  const testCaseId = params.id as string;
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [testCaseName, setTestCaseName] = useState("New Test Case");
  const [testCaseDescription, setTestCaseDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load test case
  useEffect(() => {
    async function load() {
      try {
        const res = await testCasesApi.get(testCaseId);
        const tc = res.data;
        setTestCaseName(tc.name);
        setTestCaseDescription(tc.description || "");

        let flowData;
        try {
          flowData = typeof tc.flowData === 'string' ? JSON.parse(tc.flowData) : tc.flowData;
        } catch {
          flowData = { nodes: [], edges: [] };
        }

        if (flowData.nodes?.length > 0) {
          setNodes(flowData.nodes.map((n: any) => ({ ...n, type: n.type || blockTypeToNodeType(n.data?.blockType || 'actionNode') })));
          nodeIdCounter = flowData.nodes.length + 1;
        }
        if (flowData.edges?.length > 0) {
          setEdges(flowData.edges);
        }
      } catch {
        // New test case, start with default
        setNodes([
          { id: "start-1", type: "startNode", position: { x: 250, y: 50 }, data: { label: "Start", blockType: "start" } },
          { id: "end-1", type: "endNode", position: { x: 250, y: 400 }, data: { label: "End", blockType: "end" } },
        ]);
      }
      setLoaded(true);
    }
    load();
  }, [testCaseId]);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("application/reactflow-blocktype");
      if (!blockType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const config = getBlockConfig(blockType);
      const newNode: Node = {
        id: `${blockType}-${++nodeIdCounter}`,
        type: blockTypeToNodeType(blockType),
        position,
        data: {
          label: config?.label || blockType,
          blockType,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes]
  );

  function updateNodeData(id: string, data: any) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data } : n)));
    if (selectedNode?.id === id) {
      setSelectedNode((prev) => prev ? { ...prev, data } : null);
    }
  }

  function deleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const validation = validateFlow(nodes, edges);
      const status = validation.valid ? "active" : "draft";
      await testCasesApi.update(testCaseId, {
        name: testCaseName,
        description: testCaseDescription,
        flowData: { nodes, edges },
        status,
      });
      toast.success("Test case saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleValidate() {
    const result = validateFlow(nodes, edges);
    if (result.valid && result.warnings.length === 0) {
      toast.success("Flow is valid!");
    } else {
      result.errors.forEach((e) => toast.error(e));
      result.warnings.forEach((w) => toast.warning(w));
    }
  }

  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);

  async function handleRefine() {
    setRefining(true);
    try {
      // Extract test case steps from flow nodes
      const startNode = nodes.find(n => n.data?.blockType === "start");
      const baseUrl = (startNode?.data as any)?.baseUrl || "";
      const stepNodes = nodes.filter(n => n.data?.blockType && n.data.blockType !== "start" && n.data.blockType !== "end");

      const steps = stepNodes.map((n, i) => ({
        order: i + 1,
        action: (n.data as any).blockType,
        target: (n.data as any).selector || (n.data as any).url,
        value: (n.data as any).value || (n.data as any).expectedValue,
        description: (n.data as any).description || (n.data as any).label,
      }));

      const testCases = [{
        name: testCaseName,
        description: testCaseDescription,
        steps,
      }];

      // Scrape pages for context
      const extensionId = getExtensionId();
      const pageContexts: { url: string; html: string }[] = [];

      if (extensionId) {
        // Collect URLs to scrape (base URL + any navigate targets)
        const urls = new Set<string>();
        if (baseUrl) urls.add(baseUrl);
        for (const step of steps) {
          if (step.action === "navigate" && step.target) {
            try {
              const url = new URL(step.target, baseUrl || undefined).href;
              urls.add(url);
            } catch { /* skip invalid */ }
          }
        }

        if (urls.size > 0) {
          toast.info(`Scraping ${urls.size} page(s) for context...`);
          for (const url of urls) {
            try {
              const result = await scrapePageViaExtension(extensionId, url);
              if (result.html) pageContexts.push({ url, html: result.html });
            } catch { /* skip */ }
          }
        }
      }

      if (pageContexts.length === 0) {
        // No page context — still call refine for AI-based auto-fix without HTML
        toast.info("No page context available — AI will refine based on step logic only");
      }

      const res = await generateApi.refine(testCases, pageContexts.length > 0 ? pageContexts : [{ url: baseUrl || "unknown", html: "" }], baseUrl || undefined);
      const refined = res.data.testCases?.[0];

      if (!refined || !refined.steps?.length) {
        toast.warning("AI returned no refinements");
        return;
      }

      // Rebuild flow nodes from refined steps
      const newNodes: Node[] = [
        { id: "start-1", type: "startNode", position: { x: 250, y: 0 }, data: { label: "Start", blockType: "start", baseUrl } },
      ];
      const newEdges: Edge[] = [];

      refined.steps.forEach((step: any, i: number) => {
        const nodeId = `step-${i + 1}`;
        const blockType = step.action || "click";
        newNodes.push({
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
        newEdges.push({
          id: `e-${i === 0 ? "start-1" : `step-${i}`}-${nodeId}`,
          source: i === 0 ? "start-1" : `step-${i}`,
          target: nodeId,
          animated: true,
        });
      });

      const endId = "end-1";
      newNodes.push({
        id: endId,
        type: "endNode",
        position: { x: 250, y: newNodes.length * 120 },
        data: { label: "End", blockType: "end" },
      });
      if (newNodes.length > 2) {
        newEdges.push({
          id: `e-step-${refined.steps.length}-${endId}`,
          source: `step-${refined.steps.length}`,
          target: endId,
          animated: true,
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);
      if (refined.name) setTestCaseName(refined.name);
      if (refined.description) setTestCaseDescription(refined.description);
      toast.success("Test case refined by AI");
    } catch (err: any) {
      toast.error(err.message || "Failed to refine test case");
    } finally {
      setRefining(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      // Save first to ensure latest flow is persisted
      await handleSave();
      await runTestCase(testCaseId);
    } catch (err: any) {
      toast.error(err.message || "Failed to run test case");
    } finally {
      setRunning(false);
    }
  }

  async function handleExport(format: 'json' | 'docx' | 'pdf') {
    try {
      const blob = await exportApi.testCase(testCaseId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-case.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    }
  }

  async function handleDelete() {
    try {
      await testCasesApi.delete(testCaseId);
      toast.success("Test case deleted");
      router.push("/test-cases");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <input
            value={testCaseName}
            onChange={(e) => setTestCaseName(e.target.value)}
            className="bg-transparent border-none outline-none text-lg font-semibold w-full max-w-md"
            placeholder="Test case name..."
          />
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleValidate}>
              <ListChecks className="h-4 w-4 mr-1" /> Validate
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefine} disabled={refining || saving}>
              {refining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {refining ? "Refining..." : "Refine"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRun} disabled={running || saving}>
              <Play className="h-4 w-4 mr-1" /> {running ? "Running..." : "Run"}
            </Button>
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
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <BlockPalette />
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-muted/20"
          >
            <Controls />
            <MiniMap />
            <Background gap={16} size={1} />
          </ReactFlow>
        </div>
        <BlockPropertiesPanel node={selectedNode} onUpdate={updateNodeData} onDelete={deleteNode} />
      </div>
    </>
  );
}

export default function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}
