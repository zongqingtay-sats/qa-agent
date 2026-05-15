/**
 * Single comment item with inline editing, reply, and delete actions.
 *
 * Renders a comment card with author avatar, timestamp, body text,
 * and action buttons. Also renders nested reply cards and an inline
 * reply textarea when active.
 *
 * @module comment-item
 */

"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Reply, Pencil, Trash2 } from "lucide-react";
import { formatRelative, formatDateTime } from "@/lib/format-date";

/** Shape of a comment object returned by the API. */
export interface Comment {
  id: string;
  testCaseId: string;
  authorId: string;
  authorName?: string;
  body: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Props for {@link CommentItem}. */
export interface CommentItemProps {
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
}

/**
 * Renders a single top-level comment with its nested replies.
 *
 * @param props - See {@link CommentItemProps}.
 * @returns The comment card element tree.
 */
export function CommentItem({
  comment, replies, editingId, editBody, replyTo, replyBody,
  onReplyTo, onReplyBodyChange, onReply, onCancelReply,
  onEdit, onEditBodyChange, onUpdate, onCancelEdit, onDelete,
}: CommentItemProps) {
  const isEditing = editingId === comment.id;
  const isReplying = replyTo === comment.id;

  return (
    <div className="space-y-2">
      <div className="rounded-md border p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
            {(comment.authorName || comment.authorId)?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-sm font-medium">{comment.authorName || comment.authorId}</span>
          <span className="text-xs text-muted-foreground" title={formatDateTime(comment.createdAt)}>{formatRelative(comment.createdAt)}</span>
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
          <Textarea placeholder="Write a reply..." value={replyBody} onChange={(e) => onReplyBodyChange(e.target.value)} rows={2} autoFocus />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={onCancelReply}>Cancel</Button>
            <Button size="sm" onClick={() => onReply(comment.id)} disabled={!replyBody.trim()}>Reply</Button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="ml-6 space-y-2">
          {replies.map((reply) => (
            <div key={reply.id} className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center">
                  {(reply.authorName || reply.authorId)?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-sm font-medium">{reply.authorName || reply.authorId}</span>
                <span className="text-xs text-muted-foreground" title={formatDateTime(reply.createdAt)}>{formatRelative(reply.createdAt)}</span>
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
