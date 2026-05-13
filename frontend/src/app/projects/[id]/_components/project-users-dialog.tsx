/**
 * Dialog for managing user access to a project.
 *
 * Shows the list of users with explicit project access and allows
 * revoking or granting access via a searchable user picker.
 * Admins always have access and are not listed here.
 *
 * @param props.open           - Whether the dialog is visible.
 * @param props.onOpenChange   - Called when the dialog open state changes.
 * @param props.projectId      - The project whose access is being managed.
 * @param props.projectAccess  - Current list of users with explicit access.
 * @param props.setProjectAccess - Setter to update access list in the parent.
 * @param props.userSearchQuery  - Current search input value.
 * @param props.setUserSearchQuery - Setter for the search input.
 * @param props.userSearchResults  - Filtered search results from the API.
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandItem,
} from "@/components/ui/command";
import { X } from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "sonner";

interface ProjectUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectAccess: { userId: string; userName: string; projectId: string }[];
  setProjectAccess: React.Dispatch<
    React.SetStateAction<{ userId: string; userName: string; projectId: string }[]>
  >;
  userSearchQuery: string;
  setUserSearchQuery: (q: string) => void;
  userSearchResults: { id: string; name: string | null; email: string | null }[];
}

export function ProjectUsersDialog({
  open, onOpenChange, projectId,
  projectAccess, setProjectAccess,
  userSearchQuery, setUserSearchQuery,
  userSearchResults,
}: ProjectUsersDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) setUserSearchQuery(""); }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project Users</DialogTitle>
          <DialogDescription>
            Manage who has access to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current users with access */}
          <div className="space-y-1">
            {projectAccess.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No users with explicit access.
              </p>
            )}
            {projectAccess.map((u) => (
              <div
                key={u.userId}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {(u.userName || u.userId)[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-sm">{u.userName || u.userId}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={async () => {
                    try {
                      await adminApi.revokeProjectAccess(projectId, u.userId);
                      setProjectAccess((prev) =>
                        prev.filter((a) => a.userId !== u.userId),
                      );
                      toast.success("Access revoked");
                    } catch {
                      toast.error("Failed to revoke access");
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add user search */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Add user
            </Label>
            <Command className="border rounded-md">
              <CommandInput
                placeholder="Search by name or email..."
                value={userSearchQuery}
                onValueChange={setUserSearchQuery}
              />
              <CommandList className="max-h-40">
                <CommandEmpty>No users found</CommandEmpty>
                {userSearchResults
                  .filter((u) => !projectAccess.some((a) => a.userId === u.id))
                  .map((u) => (
                    <CommandItem
                      key={u.id}
                      onSelect={async () => {
                        try {
                          const res = await adminApi.grantProjectAccess(
                            projectId,
                            u.id,
                          );
                          setProjectAccess((prev) => [...prev, res.data]);
                          toast.success(`Added ${u.name || u.email}`);
                          setUserSearchQuery("");
                        } catch {
                          toast.error("Failed to grant access");
                        }
                      }}
                    >
                      <div className="h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center mr-2">
                        {(u.name || u.email || "?")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm">{u.name || u.email}</span>
                      {u.name && u.email && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {u.email}
                        </span>
                      )}
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
