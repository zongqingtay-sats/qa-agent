/**
 * Dialog for managing user access to a project.
 *
 * Shows users with explicit project access, their project-specific role
 * (if any), and allows granting/revoking access and changing per-project roles.
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandItem,
} from "@/components/ui/command";
import { X } from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";

interface ProjectAccessEntry {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  avatarBg?: string | null;
  avatarText?: string | null;
  role: { id: string; name: string; isAdmin: boolean } | null;
  grantedBy: string | null;
  grantedAt: string;
}

interface RoleOption {
  id: string;
  name: string;
}

interface ProjectUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectAccess: ProjectAccessEntry[];
  setProjectAccess: React.Dispatch<React.SetStateAction<ProjectAccessEntry[]>>;
  userSearchQuery: string;
  setUserSearchQuery: (q: string) => void;
  userSearchResults: { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }[];
}

export function ProjectUsersDialog({
  open, onOpenChange, projectId,
  projectAccess, setProjectAccess,
  userSearchQuery, setUserSearchQuery,
  userSearchResults,
}: ProjectUsersDialogProps) {
  const [roles, setRoles] = useState<RoleOption[]>([]);

  // Load available roles when dialog opens
  useEffect(() => {
    if (!open) return;
    adminApi.listRoles().then((res) => {
      setRoles(res.data.map((r: any) => ({ id: r.id, name: r.name })));
    }).catch(() => {});
  }, [open]);

  async function handleRoleChange(userId: string, roleId: string | null) {
    try {
      await adminApi.setProjectRole(projectId, userId, roleId);
      setProjectAccess((prev) =>
        prev.map((a) =>
          a.userId === userId
            ? { ...a, role: roleId ? (roles.find((r) => r.id === roleId) ? { ...roles.find((r) => r.id === roleId)!, isAdmin: false } : a.role) : null }
            : a
        )
      );
      toast.success("Project role updated");
    } catch {
      toast.error("Failed to update role");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setUserSearchQuery(""); }}>
      <DialogContent className="max-w-lg min-w-1/2">
        <DialogHeader>
          <DialogTitle>Project Users</DialogTitle>
          <DialogDescription>
            Manage who has access and their role in this project. Users can have a project-specific role that overrides their global role.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current users with access */}
          <div className="space-y-1">
            {projectAccess.length === 0 && (
              <p className="text-sm text-muted-foreground">No users with explicit access.</p>
            )}
            {projectAccess.map((u) => (
              <div key={u.userId} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50">
                <div
                  className={`h-7 w-7 rounded-full text-xs flex items-center justify-center shrink-0 ${!u.avatarBg ? "bg-primary text-primary-foreground" : ""}`}
                  style={u.avatarBg ? { backgroundColor: u.avatarBg, color: "#fff" } : undefined}
                >
                  {u.avatarText || (u.name || u.email || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name || u.email || u.userId}</div>
                  {u.email && u.name && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                </div>
                <Select
                  value={u.role?.id || "__global__"}
                  onValueChange={(v) => handleRoleChange(u.userId, v === "__global__" ? null : v)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue>
                      {u.role ? u.role.name : <span className="text-muted-foreground">Global role</span>}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">
                      <span className="text-muted-foreground">Global role</span>
                    </SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                  onClick={async () => {
                    try {
                      await adminApi.revokeProjectAccess(projectId, u.userId);
                      setProjectAccess((prev) => prev.filter((a) => a.userId !== u.userId));
                      toast.success("Access revoked");
                    } catch { toast.error("Failed to revoke access"); }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add user search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Add user</Label>
            <Command className="border rounded-md">
              <CommandInput placeholder="Search by name or email..." value={userSearchQuery} onValueChange={setUserSearchQuery} />
              <CommandList className="max-h-40">
                <CommandEmpty>No users found</CommandEmpty>
                {userSearchResults
                  .filter((u) => !projectAccess.some((a) => a.userId === u.id))
                  .map((u) => (
                    <CommandItem
                      key={u.id}
                      onSelect={async () => {
                        try {
                          await adminApi.grantProjectAccess(projectId, u.id);
                          const res = await adminApi.getProjectAccess(projectId);
                          setProjectAccess(res.data);
                          toast.success(`Added ${u.name || u.email}`);
                          setUserSearchQuery("");
                        } catch { toast.error("Failed to grant access"); }
                      }}
                    >
                      <div
                        className={`h-6 w-6 rounded-full text-xs flex items-center justify-center mr-2 ${!u.avatarBg ? "bg-muted text-muted-foreground" : ""}`}
                        style={u.avatarBg ? { backgroundColor: u.avatarBg, color: "#fff" } : undefined}
                      >
                        {u.avatarText || (u.name || u.email || "?")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm">{u.name || u.email}</span>
                      {u.name && u.email && <span className="text-xs text-muted-foreground ml-1">{u.email}</span>}
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
