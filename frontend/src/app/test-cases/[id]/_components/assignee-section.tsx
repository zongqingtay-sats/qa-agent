"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, X } from "lucide-react";
import { assignmentsApi } from "@/lib/api";
import { toast } from "sonner";

interface Assignment {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  assignedAt: string;
}

export function AssigneeSection({ testCaseId }: { testCaseId: string }) {
  const [assignees, setAssignees] = useState<Assignment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function handleAssign() {
    const userId = newUser.trim();
    if (!userId) return;
    try {
      await assignmentsApi.assign(testCaseId, [userId]);
      setNewUser("");
      setShowAdd(false);
      load();
    } catch { toast.error("Failed to assign user"); }
  }

  async function handleRemove(userId: string) {
    try {
      await assignmentsApi.remove(testCaseId, userId);
      load();
    } catch { toast.error("Failed to remove assignee"); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Assignees</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {showAdd && (
          <div className="flex gap-2">
            <Input
              placeholder="User ID"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAssign()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleAssign} disabled={!newUser.trim()}>Add</Button>
          </div>
        )}
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
