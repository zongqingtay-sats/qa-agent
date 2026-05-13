/**
 * Threaded comments section for a test case.
 *
 * Fetches comments from the API, organises them into a parent/reply
 * tree, and renders each thread via {@link CommentItem}. Provides
 * inline controls for creating, replying, editing, and deleting comments.
 *
 * @module comments-section
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import { commentsApi } from "@/lib/api";
import { toast } from "sonner";
import { CommentItem, type Comment } from "./comment-item";

/**
 * Renders a card with a threaded comment list and a new-comment form.
 *
 * @param props.testCaseId - The test case whose comments to display.
 */
export function CommentsSection({ testCaseId }: { testCaseId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newBody, setNewBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);

  /** Fetch all comments for this test case. */
  const load = useCallback(async () => {
    try { setComments((await commentsApi.list(testCaseId)).data); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, [testCaseId]);

  useEffect(() => { load(); }, [load]);

  /** Post a new top-level comment. */
  async function handleCreate() {
    if (!newBody.trim()) return;
    try { await commentsApi.create(testCaseId, { body: newBody.trim() }); setNewBody(""); load(); }
    catch { toast.error("Failed to add comment"); }
  }

  /** Post a reply to an existing comment. */
  async function handleReply(parentId: string) {
    if (!replyBody.trim()) return;
    try { await commentsApi.create(testCaseId, { body: replyBody.trim(), parentId }); setReplyTo(null); setReplyBody(""); load(); }
    catch { toast.error("Failed to reply"); }
  }

  /** Save edits to an existing comment. */
  async function handleUpdate(commentId: string) {
    if (!editBody.trim()) return;
    try { await commentsApi.update(commentId, { body: editBody.trim() }); setEditingId(null); setEditBody(""); load(); }
    catch { toast.error("Failed to update comment"); }
  }

  /** Delete a comment by id. */
  async function handleDelete(commentId: string) {
    try { await commentsApi.delete(commentId); load(); }
    catch { toast.error("Failed to delete comment"); }
  }

  // Build threaded structure
  const topLevel = comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const r of comments.filter((c) => c.parentId)) {
    const existing = repliesByParent.get(r.parentId!) || [];
    existing.push(r);
    repliesByParent.set(r.parentId!, existing);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : topLevel.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet</p>
        ) : (
          <div className="space-y-3">
            {topLevel.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesByParent.get(comment.id) || []}
                editingId={editingId} editBody={editBody}
                replyTo={replyTo} replyBody={replyBody}
                onReplyTo={(id) => { setReplyTo(id); setReplyBody(""); }}
                onReplyBodyChange={setReplyBody}
                onReply={handleReply} onCancelReply={() => setReplyTo(null)}
                onEdit={(id, body) => { setEditingId(id); setEditBody(body); }}
                onEditBodyChange={setEditBody}
                onUpdate={handleUpdate} onCancelEdit={() => setEditingId(null)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        {/* New comment */}
        <div className="space-y-2">
          <Textarea placeholder="Add a comment..." value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={2} />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={!newBody.trim()}>Comment</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
