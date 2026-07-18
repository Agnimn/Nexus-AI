import React, { useEffect } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const queryClient = useQueryClient();

  // When the login page mounts, always wipe any stale JWT and cached data.
  // This guarantees a clean slate whether the user was redirected here after
  // logout or navigated directly — preventing a previous user's data from
  // being visible when a new user tries to connect a different GitHub account.
  useEffect(() => {
    localStorage.removeItem("nexus_auth_token");
    queryClient.clear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || ""}/api/auth/github`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4">
              <img src="/favicon.svg" alt="Nexus AI" className="h-16 w-16 rounded-2xl" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Nexus AI</h1>
            <p className="text-lg text-muted-foreground">
              Codebase Mission Control. Connect your repositories for AI-powered code reviews, risk assessment, and deep developer analytics.
            </p>
          </div>

          <div className="pt-8">
            <Button size="lg" className="w-full text-lg h-14" onClick={handleLogin}>
              <Github className="mr-2 h-6 w-6" />
              Connect with GitHub
            </Button>
          </div>

          <div className="text-sm text-muted-foreground pt-12">
            Secure, read-only access to your repositories. We don't store your source code.
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
