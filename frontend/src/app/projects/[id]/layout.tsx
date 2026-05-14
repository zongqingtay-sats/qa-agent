/**
 * Project detail layout with tab navigation.
 *
 * Provides the project header (editable name) and tab bar that navigates
 * between Overview, Cases, Campaigns, and Runs sub-pages.
 */

"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FolderKanban, MoreVertical, Trash2, Users, LayoutDashboard, TestTube2, Play, ListChecks } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useBreadcrumbLabel } from "@/components/layout/breadcrumb";
import { projectsApi, adminApi, usersApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectUsersDialog } from "./_components/project-users-dialog";

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const pathname = usePathname();

  const [projectName, setProjectName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Users dialog state
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [projectAccess, setProjectAccess] = useState<
    { userId: string; name: string | null; email: string | null; image: string | null; role: { id: string; name: string; isAdmin: boolean } | null; grantedBy: string | null; grantedAt: string }[]
  >([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<
    { id: string; name: string | null; email: string | null; avatarBg?: string | null; avatarText?: string | null }[]
  >([]);

  useBreadcrumbLabel(projectId, projectName || undefined);

  const tabs: Tab[] = [
    { label: "Overview", href: `/projects/${projectId}`, icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Cases", href: `/projects/${projectId}/cases`, icon: <TestTube2 className="h-4 w-4" /> },
    { label: "Campaigns", href: `/projects/${projectId}/campaigns`, icon: <ListChecks className="h-4 w-4" /> },
    { label: "Runs", href: `/projects/${projectId}/runs`, icon: <Play className="h-4 w-4" /> },
  ];

  const loadProject = useCallback(async () => {
    try {
      const res = await projectsApi.get(projectId);
      setProjectName(res.data.name);
      setOriginalName(res.data.name);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // Load project access
  const loadProjectAccess = useCallback(async () => {
    try {
      const res = await adminApi.getProjectAccess(projectId);
      setProjectAccess(res.data);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { loadProjectAccess(); }, [loadProjectAccess]);

  // User search for dialog
  useEffect(() => {
    if (!usersDialogOpen) return;
    const search = async () => {
      try {
        setUserSearchResults((await usersApi.search(userSearchQuery || undefined)).data);
      } catch { /* ignore */ }
    };
    search();
  }, [userSearchQuery, usersDialogOpen]);

  async function handleRename() {
    if (!projectName.trim() || projectName === originalName) {
      setProjectName(originalName);
      return;
    }
    try {
      await projectsApi.update(projectId, { name: projectName.trim() });
      setOriginalName(projectName.trim());
      toast.success("Project renamed");
    } catch {
      setProjectName(originalName);
      toast.error("Failed to rename project");
    }
  }

  async function handleDelete() {
    try {
      await projectsApi.delete(projectId);
      toast.success("Project deleted");
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  function isActive(tab: Tab) {
    if (tab.href === `/projects/${projectId}`) {
      // Overview tab is active only for exact match
      return pathname === `/projects/${projectId}`;
    }
    return pathname.startsWith(tab.href);
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 shrink-0" />
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setProjectName(originalName); (e.target as HTMLInputElement).blur(); }
              }}
              className="bg-transparent border-none outline-none text-lg font-semibold w-full"
              placeholder="Project name..."
            />
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setUserSearchQuery(""); setUsersDialogOpen(true); }}>
              <Users className="h-4 w-4 mr-1" /> {projectAccess.length}
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            } />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        }
      />

      {/* Tab navigation */}
      <nav className="border-b px-4">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm transition-colors flex items-center gap-1.5",
                isActive(tab)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {children}

      {/* Delete project confirmation */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>Are you sure you want to delete &ldquo;{projectName}&rdquo;? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectUsersDialog
        open={usersDialogOpen} onOpenChange={setUsersDialogOpen}
        projectId={projectId} projectAccess={projectAccess} setProjectAccess={setProjectAccess}
        userSearchQuery={userSearchQuery} setUserSearchQuery={setUserSearchQuery}
        userSearchResults={userSearchResults}
      />
    </>
  );
}
