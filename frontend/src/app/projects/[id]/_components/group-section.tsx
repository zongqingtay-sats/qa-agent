/**
 * Renders a single collapsible group card with optional nested sub-groups.
 *
 * Used by the project detail page to show test cases organised by
 * feature, phase, or a nested combination.
 *
 * @module group-section
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Eye, EyeOff, Trash2 } from "lucide-react";
import { TestCaseRows } from "./test-case-rows";
import type { GroupedSection } from "../_lib/group-builder";

/** Union type for group categories. */
type GroupType = "feature" | "phase";

/** State bag needed to render group rows. */
export interface GroupSectionProps {
  group: GroupedSection;
  hiddenGroups: Set<string>;
  collapsedGroups: Set<string>;
  selected: Set<string>;
  editingGroup: { type: GroupType; id: string; name: string } | null;
  setEditingGroup: (v: { type: GroupType; id: string; name: string } | null) => void;
  toggleCollapse: (key: string) => void;
  toggleGroupVisibility: (type: GroupType, id: string) => void;
  toggleSelect: (id: string) => void;
  handleRenameGroup: (type: GroupType, id: string, name: string) => void;
  setDeleteTarget: (v: { type: GroupType; id: string; name: string } | null) => void;
}

/**
 * A collapsible card for a single group (and optional sub-groups).
 *
 * @param props - See {@link GroupSectionProps}.
 */
export function GroupSection({
  group, hiddenGroups, collapsedGroups, selected, editingGroup, setEditingGroup,
  toggleCollapse, toggleGroupVisibility, toggleSelect, handleRenameGroup, setDeleteTarget,
}: GroupSectionProps) {
  const isHidden = hiddenGroups.has(group.key);
  const isCollapsed = collapsedGroups.has(group.key);
  const visibleItems = isHidden ? [] : group.items;

  return (
    <Card className="p-0 gap-0">
      {/* Group header */}
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors">
        <button type="button" className="flex items-center justify-center shrink-0" onClick={() => toggleCollapse(group.key)}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <GroupLabel
          groupId={group.groupId} groupType={group.groupType} label={group.label}
          editingGroup={editingGroup} setEditingGroup={setEditingGroup}
          handleRenameGroup={handleRenameGroup} className="font-medium flex-1"
        />
        <Badge variant="secondary">{group.items.length}</Badge>
        {isHidden && <span className="text-xs text-muted-foreground">{group.items.length} hidden</span>}
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(group.groupType, group.groupId); }}
          title={isHidden ? "Show" : "Hide"}
        >
          {isHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
        </Button>
        {group.groupId !== "unassigned" && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: group.groupType, id: group.groupId, name: group.label }); }}
            title={`Delete ${group.groupType}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Group body */}
      {!isCollapsed && !isHidden && (
        <CardContent className="pt-0 pb-3">
          {group.subGroups && group.subGroups.length > 0 ? (
            <div className="pt-3 space-y-3">
              {group.subGroups.map((sub) => {
                const subHidden = hiddenGroups.has(sub.key);
                const subCollapsed = collapsedGroups.has(sub.key);
                return (
                  <div key={sub.key} className="rounded-md ring-1 ring-foreground/10">
                    <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                      <button type="button" className="flex items-center justify-center shrink-0" onClick={() => toggleCollapse(sub.key)}>
                        {subCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <GroupLabel
                        groupId={sub.groupId} groupType={sub.groupType} label={sub.label}
                        editingGroup={editingGroup} setEditingGroup={setEditingGroup}
                        handleRenameGroup={handleRenameGroup} className="text-sm font-medium flex-1"
                      />
                      <Badge variant="secondary" className="text-xs">{sub.items.length}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(sub.groupType, sub.groupId); }}
                      >
                        {subHidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {!subCollapsed && !subHidden && (
                      <div className="px-3 pb-2">
                        <TestCaseRows items={sub.items} selected={selected} toggleSelect={toggleSelect} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <TestCaseRows items={visibleItems} selected={selected} toggleSelect={toggleSelect} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Internal helper ─────────────────────────────────────────────────

/** Inline-editable group label (double-click to edit). */
function GroupLabel({
  groupId, groupType, label, editingGroup, setEditingGroup, handleRenameGroup, className,
}: {
  groupId: string; groupType: GroupType; label: string; className?: string;
  editingGroup: { type: GroupType; id: string; name: string } | null;
  setEditingGroup: (v: { type: GroupType; id: string; name: string } | null) => void;
  handleRenameGroup: (type: GroupType, id: string, name: string) => void;
}) {
  if (editingGroup?.id === groupId && editingGroup?.type === groupType) {
    return (
      <input
        className={`${className} bg-transparent border-b border-primary outline-none`}
        value={editingGroup.name}
        onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
        onBlur={() => handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleRenameGroup(editingGroup.type, editingGroup.id, editingGroup.name);
          if (e.key === "Escape") setEditingGroup(null);
        }}
        autoFocus
      />
    );
  }
  return (
    <span
      className={`${className} cursor-default`}
      onDoubleClick={() => { if (groupId !== "unassigned") setEditingGroup({ type: groupType, id: groupId, name: label }); }}
    >{label}</span>
  );
}
