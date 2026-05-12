"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import { Users, Plus, X } from "lucide-react";
import { assignmentsApi, usersApi } from "@/lib/api";
import { toast } from "sonner";

interface Assignment {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  assignedAt: string;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
}

export function AssigneeSection({ testCaseId }: { testCaseId: string }) {
  const [assignees, setAssignees] = useState<Assignment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await assignmentsApi.list(testCaseId);
      setAssignees(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => { load(); }, [load]);

  // Debounced user search
  useEffect(() => {
    if (!showAdd) return;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await usersApi.search(searchQuery || undefined);
        setUsers(res.data);
      } catch {
        // silent
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, showAdd]);

  async function handleAssign(user: UserOption) {
    try {
      await assignmentsApi.assign(testCaseId, [user.id], [user.name || undefined] as string[]);
      setShowAdd(false);
      setSearchQuery("");
      load();
    } catch { toast.error("Failed to assign user"); }
  }

  async function handleRemove(userId: string) {
    try {
      await assignmentsApi.remove(testCaseId, userId);
      load();
    } catch { toast.error("Failed to remove assignee"); }
  }

  const assignedIds = new Set(assignees.map((a) => a.userId));

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Assignees</span>
          <Popover open={showAdd} onOpenChange={setShowAdd}>
            <PopoverTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
              <Plus className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-0">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search by name..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList>
                  {searching ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">Searching...</div>
                  ) : users.filter((u) => !assignedIds.has(u.id)).length === 0 ? (
                    <CommandEmpty>No users found</CommandEmpty>
                  ) : (
                    users
                      .filter((u) => !assignedIds.has(u.id))
                      .map((u) => (
                        <CommandItem key={u.id} onSelect={() => handleAssign(u)}>
                          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                            {(u.name || u.email)?.[0]?.toUpperCase() || "?"}
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
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : assignees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignees</p>
        ) : (
          <div className="space-y-1">
            {assignees.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                  {(a.userName || a.userId)?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-sm flex-1 truncate">{a.userName || a.userId}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemove(a.userId)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
