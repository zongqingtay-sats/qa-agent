/**
 * Block type configuration and lookup helpers for the visual flow editor.
 *
 * Each entry in `BLOCK_TYPES` describes the visual appearance, category,
 * and icon of a block that can appear in the test flow.  The list drives
 * the block palette, the node renderer, and the properties panel.
 */

import {
  CheckCircle,
  MousePointerClick,
  Type,
  Globe,
  Clock,
  Variable,
  GitBranch,
  Camera,
  ChevronDown,
  CircleDot,
  CircleStop,
  Hand,
  ArrowDownUp,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

/** Describes a single block type's metadata. */
export interface BlockConfig {
  /** Machine-readable block type identifier (e.g. "click", "navigate"). */
  type: string;
  /** Human-readable display label. */
  label: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Grouping category shown in the palette. */
  category: "Control" | "Action" | "Validation" | "Capture";
  /** Tailwind CSS classes for background, border, and text colour. */
  color: string;
}

/**
 * Ordered list of every block type available in the editor.
 *
 * The order here determines the order inside the block palette.
 */
export const BLOCK_TYPES: BlockConfig[] = [
  { type: "start", label: "Start", icon: CircleDot, category: "Control", color: "bg-green-100 border-green-400 text-green-800" },
  { type: "end", label: "End", icon: CircleStop, category: "Control", color: "bg-red-100 border-red-400 text-red-800" },
  { type: "navigate", label: "Navigate", icon: Globe, category: "Action", color: "bg-blue-100 border-blue-400 text-blue-800" },
  { type: "click", label: "Click", icon: MousePointerClick, category: "Action", color: "bg-purple-100 border-purple-400 text-purple-800" },
  { type: "type", label: "Type", icon: Type, category: "Action", color: "bg-orange-100 border-orange-400 text-orange-800" },
  { type: "select", label: "Select", icon: ChevronDown, category: "Action", color: "bg-indigo-100 border-indigo-400 text-indigo-800" },
  { type: "hover", label: "Hover", icon: Hand, category: "Action", color: "bg-pink-100 border-pink-400 text-pink-800" },
  { type: "scroll", label: "Scroll", icon: ArrowDownUp, category: "Action", color: "bg-cyan-100 border-cyan-400 text-cyan-800" },
  { type: "wait", label: "Wait", icon: Clock, category: "Action", color: "bg-yellow-100 border-yellow-400 text-yellow-800" },
  { type: "wait-until", label: "Wait Until", icon: Hourglass, category: "Action", color: "bg-teal-100 border-teal-400 text-teal-800" },
  { type: "set-variable", label: "Set Variable", icon: Variable, category: "Control", color: "bg-violet-100 border-violet-400 text-violet-800" },
  { type: "assert", label: "Assert", icon: CheckCircle, category: "Validation", color: "bg-emerald-100 border-emerald-400 text-emerald-800" },
  { type: "if-else", label: "If-Else", icon: GitBranch, category: "Control", color: "bg-amber-100 border-amber-400 text-amber-800" },
  { type: "screenshot", label: "Screenshot", icon: Camera, category: "Capture", color: "bg-slate-100 border-slate-400 text-slate-800" },
];

/**
 * Look up the configuration for a given block type string.
 *
 * @param blockType - The machine-readable block type (e.g. "click").
 * @returns The matching `BlockConfig`, or `undefined` if unknown.
 */
export function getBlockConfig(blockType: string): BlockConfig | undefined {
  return BLOCK_TYPES.find((b) => b.type === blockType);
}

/**
 * Map a logical block type to the ReactFlow custom node type
 * registered via `nodeTypes`.
 *
 * @param blockType - Logical block type string.
 * @returns The ReactFlow node type key.
 */
export function blockTypeToNodeType(blockType: string): string {
  switch (blockType) {
    case "start":
      return "startNode";
    case "end":
      return "endNode";
    case "assert":
      return "assertNode";
    case "if-else":
      return "conditionNode";
    case "screenshot":
      return "captureNode";
    default:
      return "actionNode";
  }
}
