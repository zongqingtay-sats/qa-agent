/**
 * Application sidebar with navigation links and user info.
 *
 * Uses Shadcn's collapsible `Sidebar` component. Shows main nav items
 * (Dashboard, Projects, Test Cases, etc.) plus an administration
 * section (Users, Roles). The footer displays the signed-in user and
 * a sign-out button.
 *
 * @module app-sidebar
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  TestTube2,
  Play,
  Sparkles,
  Settings,
  FlaskConical,
  FolderKanban,
  LogOut,
  User,
  Users,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usersApi } from "@/lib/api";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Test Cases", href: "/test-cases", icon: TestTube2 },
  { title: "Test Runs", href: "/test-runs", icon: Play },
  { title: "Generate", href: "/generate", icon: Sparkles },
];

const adminItems = [
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Roles", href: "/admin/roles", icon: Shield },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [avatarBg, setAvatarBg] = useState<string | null>(null);
  const [avatarText, setAvatarText] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    usersApi.getProfile().then((res) => {
      setAvatarBg(res.data.avatarBg || null);
      setAvatarText(res.data.avatarText || null);
    }).catch(() => {});
  }, [session?.user]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg min-w-0 overflow-hidden">
            <FlaskConical className="h-6 w-6 text-primary shrink-0 pl-1" />
            <span className="truncate transition-[opacity,width] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
              QA Agent
            </span>
          </Link>
          <SidebarTrigger className="shrink-0 transition-opacity duration-200" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} title={item.title} />} isActive={isActive}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} title={item.title} />} isActive={isActive}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {session?.user && (
        <SidebarFooter className="border-t px-2 py-3 space-y-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/settings" title="Settings" />} isActive={pathname.startsWith("/settings")}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <Link
              href="/profile"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium hover:opacity-80 transition-opacity ${!avatarBg ? "bg-primary text-primary-foreground" : ""}`}
              style={avatarBg ? { backgroundColor: avatarBg, color: "#fff" } : undefined}
              title="Profile"
            >
              {avatarText || session.user.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </Link>
            <Link href="/profile" className="flex-1 min-w-0 transition-[opacity,width] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0 hover:opacity-80">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
