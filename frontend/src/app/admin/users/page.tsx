"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Shield, Search, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: { id: string; name: string; isAdmin: boolean } | null;
}

interface RoleOption {
  id: string;
  name: string;
  isAdmin: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Unified create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogUser, setDialogUser] = useState<UserRow | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogEmail, setDialogEmail] = useState("");
  const [dialogRoleId, setDialogRoleId] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([adminApi.listUsers(), adminApi.listRoles()]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setDialogMode("create");
    setDialogUser(null);
    setDialogName("");
    setDialogEmail("");
    setDialogRoleId("");
    setDialogOpen(true);
  }

  function openEdit(user: UserRow) {
    setDialogMode("edit");
    setDialogUser(user);
    setDialogName(user.name || "");
    setDialogEmail(user.email || "");
    setDialogRoleId(user.role?.id || "__none__");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
  }

  async function handleDialogSubmit() {
    setDialogSaving(true);
    try {
      if (dialogMode === "create") {
        if (!dialogEmail.trim()) { toast.error("Email is required"); return; }
        await adminApi.createUser({
          name: dialogName.trim() || undefined,
          email: dialogEmail.trim(),
          roleId: dialogRoleId && dialogRoleId !== "__none__" ? dialogRoleId : undefined,
        });
        toast.success(`User ${dialogEmail.trim()} created`);
      } else {
        if (!dialogUser) return;
        await adminApi.updateUser(dialogUser.id, {
          name: dialogName.trim() || undefined,
          email: dialogEmail.trim() || undefined,
        });
        if (dialogRoleId === "__none__") {
          await adminApi.removeUserRole(dialogUser.id);
        } else {
          await adminApi.setUserRole(dialogUser.id, dialogRoleId);
        }
        toast.success(`User updated`);
      }
      closeDialog();
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setDialogSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.name || deleteTarget.email} has been deactivated`);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.name?.toLowerCase().includes(q)
    );
  });

  const selectedRoleName = !dialogRoleId || dialogRoleId === "__none__"
    ? "No role (defaults to Reader)"
    : (roles.find((r) => r.id === dialogRoleId)?.name ?? "Select a role");

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={<span className="flex items-center gap-2"><Users className="h-5 w-5" /> User Management</span>}
        description="Manage user role assignments"
        actions={
          <Button className="ml-auto" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Badge variant="secondary">{filtered.length} users</Badge>
        </div>
        <div className="rounded-md ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {user.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        {user.name || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell>
                      {user.role ? (
                        <Badge variant={user.role.isAdmin ? "default" : "secondary"}>
                          {user.role.isAdmin && <Shield className="h-3 w-3 mr-1" />}
                          {user.role.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline">No role</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(user)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Create User" : "Edit User"}</DialogTitle>
            {dialogMode === "create" && (
              <DialogDescription>Pre-register a user so they can sign in with their Microsoft account.</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dialog-name">Name</Label>
              <Input id="dialog-name" placeholder="Full name" value={dialogName} onChange={(e) => setDialogName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-email">Email <span className="text-destructive">*</span></Label>
              <Input id="dialog-email" type="email" placeholder="user@example.com" value={dialogEmail} onChange={(e) => setDialogEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={dialogRoleId} onValueChange={(v) => setDialogRoleId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role">
                    {selectedRoleName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No role (defaults to Reader)</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} {role.isAdmin && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={dialogSaving}>Cancel</Button>
            <Button onClick={handleDialogSubmit} disabled={dialogSaving}>
              {dialogSaving ? "Saving..." : dialogMode === "create" ? "Create User" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.name || deleteTarget?.email}</strong>? They will no longer be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
