"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Reply, Pencil, Trash2 } from "lucide-react";
import { commentsApi } from "@/lib/api";
import { toast } from "sonner";

interface Comment {
  id: string;
  testCaseId: string;
  userId: string;
  userName?: string;
  body: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export function CommentsSection({ testCaseId }: { testCaseId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newBody, setNewBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await commentsApi.list(testCaseId);
      setComments(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newBody.trim()) return;
    try {
      await commentsApi.create(testCaseId, { body: newBody.trim() });
      setNewBody("");
      load();
    } catch { toast.error("Failed to add comment"); }
  }

  async function handleReply(parentId: string) {
    if (!replyBody.trim()) return;
    try {
      await commentsApi.create(testCaseId, { body: replyBody.trim(), parentId });
      setReplyTo(null);
      setReplyBody("");
      load();
    } catch { toast.error("Failed to reply"); }
  }

  async function handleUpdate(commentId: string) {
    if (!editBody.trim()) return;
    try {
      await commentsApi.update(commentId, { body: editBody.trim() });
      setEditingId(null);
      setEditBody("");
      load();
    } catch { toast.error("Failed to update comment"); }
  }

  async function handleDelete(commentId: string) {
    try {
      await commentsApi.delete(commentId);
      load();
    } catch { toast.error("Failed to delete comment"); }
  }

  // Build threaded structure: top-level + replies
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const r of replies) {
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
        {/* New comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={!newBody.trim()}>
              Comment
            </Button>
          </div>
        </div>

        {/* Comments list */}
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
                editingId={editingId}
                editBody={editBody}
                replyTo={replyTo}
                replyBody={replyBody}
                onReplyTo={(id) => { setReplyTo(id); setReplyBody(""); }}
                onReplyBodyChange={setReplyBody}
                onReply={handleReply}
                onCancelReply={() => setReplyTo(null)}
                onEdit={(id, body) => { setEditingId(id); setEditBody(body); }}
                onEditBodyChange={setEditBody}
                onUpdate={handleUpdate}
                onCancelEdit={() => setEditingId(null)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentItem({
  comment,
  replies,
  editingId,
  editBody,
  replyTo,
  replyBody,
  onReplyTo,
  onReplyBodyChange,
  onReply,
  onCancelReply,
  onEdit,
  onEditBodyChange,
  onUpdate,
  onCancelEdit,
  onDelete,
}: {
  comment: Comment;
  replies: Comment[];
  editingId: string | null;
  editBody: string;
  replyTo: string | null;
  replyBody: string;
  onReplyTo: (id: string) => void;
  onReplyBodyChange: (v: string) => void;
  onReply: (parentId: string) => void;
  onCancelReply: () => void;
  onEdit: (id: string, body: string) => void;
  onEditBodyChange: (v: string) => void;
  onUpdate: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const isEditing = editingId === comment.id;
  const isReplying = replyTo === comment.id;

  return (
    <div className="space-y-2">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
            {(comment.userName || comment.userId)?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm font-medium">{comment.userName || comment.userId}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editBody} onChange={(e) => onEditBodyChange(e.target.value)} rows={2} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
              <Button size="sm" onClick={() => onUpdate(comment.id)} disabled={!editBody.trim()}>Save</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
        )}
        {!isEditing && (
          <div className="flex gap-1 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onReplyTo(comment.id)}>
              <Reply className="h-3 w-3 mr-1" /> Reply
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(comment.id, comment.body)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onDelete(comment.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Reply input */}
      {isReplying && (
        <div className="ml-6 space-y-2">
          <Textarea
            placeholder="Write a reply..."
            value={replyBody}
            onChange={(e) => onReplyBodyChange(e.target.value)}
            rows={2}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={onCancelReply}>Cancel</Button>
            <Button size="sm" onClick={() => onReply(comment.id)} disabled={!replyBody.trim()}>Reply</Button>
          </div>
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-6 space-y-2">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
                  {(reply.userName || reply.userId)?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-sm font-medium">{reply.userName || reply.userId}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleString()}
                </span>
              </div>
              {editingId === reply.id ? (
                <div className="space-y-2">
                  <Textarea value={editBody} onChange={(e) => onEditBodyChange(e.target.value)} rows={2} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
                    <Button size="sm" onClick={() => onUpdate(reply.id)} disabled={!editBody.trim()}>Save</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                  <div className="flex gap-1 mt-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onEdit(reply.id, reply.body)}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onDelete(reply.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
