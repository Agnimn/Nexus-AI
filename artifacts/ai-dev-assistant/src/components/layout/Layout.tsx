import React from "react";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-mono uppercase tracking-wider">Establishing connection...</p>
        </div>
      </div>
    );
  }

  if (error || !user || (user as any).error) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 max-w-[1400px] mx-auto w-full p-6 md:p-8 lg:p-10">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
