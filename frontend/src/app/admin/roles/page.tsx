"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import type { Role } from "@/types/api";

// Bitmask constants (must match backend)
const P = {
  CREATE: 1,
  READ: 2,
  UPDATE: 4,
  DELETE: 8,
  EXPORT: 16,
  RUN: 32,
  GRANT_ACCESS: 64,
  MANAGE: 128,
};

const RESOURCE_GROUPS = [
  { key: "projectPerms", label: "Projects", bits: ["CREATE", "READ", "UPDATE", "DELETE", "GRANT_ACCESS"] },
  { key: "testcasePerms", label: "Test Cases", bits: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORT"] },
  { key: "testrunPerms", label: "Test Runs", bits: ["CREATE", "READ"] },
  { key: "userPerms", label: "Users", bits: ["MANAGE"] },
  { key: "importPerms", label: "Import", bits: ["CREATE"] },
  { key: "generatePerms", label: "Generate", bits: ["CREATE"] },
] as const;

interface RoleData {
  id?: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isSystem: boolean;
  projectPerms: number;
  testcasePerms: number;
  testrunPerms: number;
  userPerms: number;
  importPerms: number;
  generatePerms: number;
}

const emptyRole: RoleData = {
  name: "",
  description: "",
  isAdmin: false,
  isSystem: false,
  projectPerms: 0,
  testcasePerms: 0,
  testrunPerms: 0,
  userPerms: 0,
  importPerms: 0,
  generatePerms: 0,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleData>(emptyRole);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  useEffect(() => { loadRoles(); }, []);

  async function loadRoles() {
    setLoading(true);
    try {
      const res = await adminApi.listRoles();
      setRoles(res.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditRole(emptyRole);
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditRole({ ...role, description: role.description ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editRole.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editRole.id) {
        await adminApi.updateRole(editRole.id, editRole);
        toast.success("Role updated");
      } else {
        await adminApi.createRole(editRole);
        toast.success("Role created");
      }
      setDialogOpen(false);
      loadRoles();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteRole(deleteTarget.id);
      toast.success("Role deleted");
      setDeleteTarget(null);
      loadRoles();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    }
  }

  function toggleBit(resource: string, bit: number) {
    setEditRole((prev) => ({
      ...prev,
      [resource]: (prev[resource as keyof RoleData] as number) ^ bit,
    }));
  }

  function hasBit(resource: string, bit: number) {
    return ((editRole[resource as keyof RoleData] as number) & bit) !== 0;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={<span className="flex items-center gap-2"><Shield className="h-5 w-5" /> Role Management</span>}
        description="Create and configure roles with granular bitmask permissions"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="rounded-md ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-25">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No roles found. Click &quot;New Role&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      {role.name}
                      {role.isAdmin && <Badge className="ml-2" variant="default">Admin</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{role.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystem ? "secondary" : "outline"}>
                        {role.isSystem ? "System" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {RESOURCE_GROUPS.map((rg) => {
                          const val = role[rg.key as keyof typeof role] as number;
                          if (!val) return null;
                          return (
                            <Badge key={rg.key} variant="outline" className="text-xs font-mono">
                              {rg.label.slice(0, 4)}:{val}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(role)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!role.isSystem && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(role)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl min-w-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRole.id ? "Edit Role" : "Create Role"}</DialogTitle>
            <DialogDescription>Configure role name and permission bitmasks per resource.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editRole.name}
                onChange={(e) => setEditRole({ ...editRole, name: e.target.value })}
                placeholder="e.g. QA Lead"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editRole.description}
                onChange={(e) => setEditRole({ ...editRole, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm">Permissions</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editRole.isAdmin}
                  onCheckedChange={(checked) => setEditRole({ ...editRole, isAdmin: !!checked })}
                />
                <Label className="text-sm">Admin (bypasses all permission checks)</Label>
              </div>
              {!editRole.isAdmin &&
                RESOURCE_GROUPS.map((rg) => (
                  <Card key={rg.key} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{rg.label}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {editRole[rg.key as keyof RoleData] as number}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {rg.bits.map((bitName) => {
                        const bitVal = P[bitName as keyof typeof P];
                        return (
                          <label key={bitName} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox
                              checked={hasBit(rg.key, bitVal)}
                              onCheckedChange={() => toggleBit(rg.key, bitVal)}
                            />
                            <span>{bitName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editRole.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? Users assigned this role will lose their permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
