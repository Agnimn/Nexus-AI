import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Code, GitBranch, LayoutDashboard, LogOut, FileText, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: GitBranch },
  { href: "/ai-reviews", label: "AI Reviews", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/code-explain", label: "Explain Code", icon: Code },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    // Capture the token BEFORE removing it so the background API call
    // can still send it as Authorization: Bearer for server-side cleanup.
    const currentToken = localStorage.getItem("nexus_auth_token");

    // Step 1 — Immediate client-side cleanup (synchronous, instant UX).
    localStorage.removeItem("nexus_auth_token");
    queryClient.clear();

    // Step 2 — Fire the server-side logout in the background (fire-and-forget).
    // Revokes the GitHub OAuth token and destroys the server session.
    // We do NOT await this — the user is already logged out client-side.
    const apiBase = import.meta.env.VITE_API_URL || "";
    fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
    }).catch(() => { /* silent — client is already logged out */ });

    // Step 3 — Navigate to root. The Layout component will detect no JWT
    // and automatically redirect to /login via React Router (client-side,
    // no full-page reload to a deep path that could 404 on Vercel).
    window.location.href = "/";
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  }, [location]);

  const sidebarContent = (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-full overflow-y-auto">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Nexus AI" className="h-9 w-9 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Nexus AI</h1>
            <p className="text-xs text-muted-foreground">Codebase Mission Control</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && !(user as any).error && (
        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 border border-border shrink-0">
              <AvatarImage src={user.avatarUrl} alt={user.login} />
              <AvatarFallback>{(user.login ?? "US").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user.name || user.login || "User"}</span>
              <span className="text-xs text-muted-foreground truncate">@{user.login || "user"}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile sidebar — slide-in drawer with backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative flex h-full w-64 flex-col">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-sidebar border border-border text-foreground shadow-md"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
