import React from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Activity, Code, GitBranch, LayoutDashboard, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: GitBranch },
  { href: "/ai-reviews", label: "AI Reviews", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/code-explain", label: "Explain Code", icon: Code },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      }
    });
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-screen overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="Nexus AI" className="h-9 w-9 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-primary">Nexus AI</h1>
            <p className="text-xs text-muted-foreground">Codebase Mission Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && !(user as any).error && (
        <div className="p-4 border-t border-border bg-card/50">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={user.avatarUrl} alt={user.login} />
              <AvatarFallback>{(user.login ?? "US").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{user.name || user.login || "User"}</span>
              <span className="text-xs text-muted-foreground truncate">@{user.login || "user"}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      )}
    </aside>
  );
}
