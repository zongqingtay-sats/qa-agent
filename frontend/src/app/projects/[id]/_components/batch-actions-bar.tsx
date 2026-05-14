/**
 * Batch action toolbar for selected test cases.
 *
 * Shows "Assign Users", "Feature / Phase", and "Delete" buttons with
 * their associated dialogs when one or more test cases are selected.
 *
 * @module batch-actions-bar
 */

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Users, Layers, Trash2, X, Play, FolderPlus } from "lucide-react";

/** Minimal user shape for the assign dialog. */
interface UserStub { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }

/** Feature / Phase option shape. */
interface GroupItem { id: string; name: string }

/** Props for {@link BatchActionsBar}. */
export interface BatchActionsBarProps {
  selectedCount: number;
  // Assign users dialog
  assignDialogOpen: boolean;
  setAssignDialogOpen: (v: boolean) => void;
  assignSelectedUsers: UserStub[];
  setAssignSelectedUsers: React.Dispatch<React.SetStateAction<UserStub[]>>;
  assignSearchQuery: string;
  setAssignSearchQuery: (v: string) => void;
  assignSearchResults: UserStub[];
  onBulkAssign: () => void;
  // Feature / Phase dialog
  assignFPDialogOpen: boolean;
  setAssignFPDialogOpen: (v: boolean) => void;
  features: GroupItem[];
  phases: GroupItem[];
  bulkFeatureIds: Set<string>;
  setBulkFeatureIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  bulkPhaseIds: Set<string>;
  setBulkPhaseIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onBulkAssignFP: () => void;
  // Run
  onRunSelected: () => void;
  // Campaign
  onCreateCampaign: () => void;
  // Delete
  onDeleteSelected: () => void;
}

/**
 * Renders the batch toolbar (only when `selectedCount > 0`).
 *
 * @param props - See {@link BatchActionsBarProps}.
 */
export function BatchActionsBar(props: BatchActionsBarProps) {
  const {
    selectedCount,
    assignDialogOpen, setAssignDialogOpen, assignSelectedUsers, setAssignSelectedUsers,
    assignSearchQuery, setAssignSearchQuery, assignSearchResults, onBulkAssign,
    assignFPDialogOpen, setAssignFPDialogOpen, features, phases,
    bulkFeatureIds, setBulkFeatureIds, bulkPhaseIds, setBulkPhaseIds, onBulkAssignFP,
    onRunSelected, onCreateCampaign, onDeleteSelected,
  } = props;

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{selectedCount} selected</span>

      {/* Bulk assign users */}
      <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) { setAssignSelectedUsers([]); setAssignSearchQuery(""); } }}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Users className="h-4 w-4 mr-1" /> Assign
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Users</DialogTitle><DialogDescription>Search and select users to assign to {selectedCount} test case(s).</DialogDescription></DialogHeader>
          <div className="py-2 space-y-3">
            {assignSelectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {assignSelectedUsers.map((u) => (
                  <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                    {u.name || u.email}
                    <Button variant="ghost" size="icon" className="ml-0.5 h-4 w-4 hover:text-destructive" onClick={() => setAssignSelectedUsers((prev) => prev.filter((p) => p.id !== u.id))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            <Command shouldFilter={false} className="rounded-md ring-1 ring-foreground/10">
              <CommandInput placeholder="Search by name..." value={assignSearchQuery} onValueChange={setAssignSearchQuery} />
              <CommandList>
                {assignSearchResults.filter((u) => !assignSelectedUsers.some((s) => s.id === u.id)).length === 0 ? (
                  <CommandEmpty>No users found</CommandEmpty>
                ) : (
                  assignSearchResults.filter((u) => !assignSelectedUsers.some((s) => s.id === u.id)).map((u) => (
                    <CommandItem key={u.id} onSelect={() => setAssignSelectedUsers((prev) => [...prev, u])}>
                      <div
                        className={`h-6 w-6 rounded-full text-xs flex items-center justify-center shrink-0 ${!u.avatarBg ? "bg-primary text-primary-foreground" : ""}`}
                        style={u.avatarBg ? { backgroundColor: u.avatarBg, color: "#fff" } : undefined}
                      >
                        {u.avatarText || (u.name || u.email)?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm truncate">{u.name || "Unnamed"}</span>
                        {u.email && <span className="text-xs text-muted-foreground truncate">{u.email}</span>}
                      </div>
                    </CommandItem>
                  ))
                )}
              </CommandList>
            </Command>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button><Button onClick={onBulkAssign} disabled={assignSelectedUsers.length === 0}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk feature / phase */}
      <Dialog open={assignFPDialogOpen} onOpenChange={(open) => { setAssignFPDialogOpen(open); if (!open) { setBulkFeatureIds(new Set()); setBulkPhaseIds(new Set()); } }}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Layers className="h-4 w-4 mr-1" /> Feature / Phase
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Feature / Phase</DialogTitle><DialogDescription>Select features and phases for {selectedCount} test case(s).</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            {features.length > 0 && (
              <div className="space-y-1.5">
                <Label>Features</Label>
                <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                  {features.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox checked={bulkFeatureIds.has(f.id)} onCheckedChange={() => setBulkFeatureIds((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                      <span className="text-sm">{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {phases.length > 0 && (
              <div className="space-y-1.5">
                <Label>Phases</Label>
                <div className="rounded-md p-2 space-y-1 max-h-40 overflow-y-auto ring-1 ring-foreground/10">
                  {phases.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <Checkbox checked={bulkPhaseIds.has(p.id)} onCheckedChange={() => setBulkPhaseIds((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                      <span className="text-sm">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {features.length === 0 && phases.length === 0 && (
              <p className="text-sm text-muted-foreground">No features or phases in this project yet.</p>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignFPDialogOpen(false)}>Cancel</Button><Button onClick={onBulkAssignFP}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="outline" size="sm" onClick={onRunSelected}><Play className="h-4 w-4 mr-1" /> Run</Button>
      <Button variant="outline" size="sm" onClick={onCreateCampaign}><FolderPlus className="h-4 w-4 mr-1" /> Campaign</Button>
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Test Cases</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} test case(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <DialogClose render={<Button variant="destructive" onClick={onDeleteSelected} />}>Delete</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
