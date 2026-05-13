/**
 * Dialog for creating or editing a user.
 *
 * Renders a form with name, email, and role selection fields.
 * Supports both "create" and "edit" modes controlled via props.
 *
 * @module user-form-dialog
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

/** Minimal role shape for the role selector. */
export interface RoleOption {
  id: string;
  name: string;
  isAdmin: boolean;
}

/** Props for {@link UserFormDialog}. */
export interface UserFormDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when open state changes. */
  onOpenChange: (open: boolean) => void;
  /** "create" shows a description about pre-registering users. */
  mode: "create" | "edit";
  /** Current name value. */
  name: string;
  /** Setter for name. */
  onNameChange: (v: string) => void;
  /** Current email value. */
  email: string;
  /** Setter for email. */
  onEmailChange: (v: string) => void;
  /** Currently selected role id (or "__none__"). */
  roleId: string;
  /** Setter for role id. */
  onRoleIdChange: (v: string) => void;
  /** Available roles for the selector. */
  roles: RoleOption[];
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Called when the user clicks the submit button. */
  onSubmit: () => void;
}

/**
 * Renders a create/edit user dialog with name, email, and role fields.
 *
 * @param props - See {@link UserFormDialogProps}.
 * @returns The dialog element.
 */
export function UserFormDialog(props: UserFormDialogProps) {
  const {
    open, onOpenChange, mode, name, onNameChange, email, onEmailChange,
    roleId, onRoleIdChange, roles, saving, onSubmit,
  } = props;

  const selectedRoleName =
    !roleId || roleId === "__none__"
      ? "No role (defaults to Reader)"
      : (roles.find((r) => r.id === roleId)?.name ?? "Select a role");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create User" : "Edit User"}</DialogTitle>
          {mode === "create" && (
            <DialogDescription>
              Pre-register a user so they can sign in with their Microsoft account.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dialog-name">Name</Label>
            <Input id="dialog-name" placeholder="Full name" value={name} onChange={(e) => onNameChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dialog-email">Email <span className="text-destructive">*</span></Label>
            <Input id="dialog-email" type="email" placeholder="user@example.com" value={email} onChange={(e) => onEmailChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={roleId} onValueChange={(v) => onRoleIdChange(v || "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role">{selectedRoleName}</SelectValue>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving ? "Saving..." : mode === "create" ? "Create User" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
