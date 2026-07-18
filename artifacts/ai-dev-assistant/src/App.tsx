import React, { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RepositoriesList from "@/pages/repositories";
import RepositoryDetail from "@/pages/repository-detail";
import PullRequestDetail from "@/pages/pull-request-detail";
import Analytics from "@/pages/analytics";
import CodeExplain from "@/pages/code-explain";
import History from "@/pages/history";

const queryClient = new QueryClient();

// ---------------------------------------------------------------------------
// OAuthTokenHandler
// After GitHub OAuth, the backend redirects to /?token=<one-time-token>.
// We POST that token to /api/auth/exchange which sets a real session cookie
// (credentialed XHR — always accepted by browsers) then navigates to /.
// ---------------------------------------------------------------------------

function OAuthTokenHandler({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (error) {
      // Clean the URL and show login
      window.history.replaceState({}, "", window.location.pathname);
      setReady(true);
      return;
    }

    if (!token) {
      setReady(true);
      return;
    }

    // Exchange one-time token for a real session cookie
    const apiBase = import.meta.env.VITE_API_URL || "";
    fetch(`${apiBase}/api/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("exchange failed");
        return res.json();
      })
      .then((data: { token?: string }) => {
        // Store the JWT so subsequent API calls use it as Authorization: Bearer.
        // This bypasses third-party cookie restrictions in Chrome/Safari.
        if (data.token) {
          localStorage.setItem("nexus_auth_token", data.token);
        }
        // Invalidate any cached auth queries so Layout re-checks /auth/me
        queryClient.invalidateQueries();
        // Strip the token from the URL and navigate to the dashboard
        window.history.replaceState({}, "", "/");
        navigate("/");
      })
      .catch(() => {
        localStorage.removeItem("nexus_auth_token");
        window.history.replaceState({}, "", "/login");
        navigate("/login");
      })
      .finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    // Show a minimal splash while the exchange is in-flight
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono uppercase tracking-wider">Authenticating…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/repositories" component={RepositoriesList} />
      <Route path="/repositories/:repoId" component={RepositoryDetail} />
      <Route path="/repositories/:repoId/pull-requests/:prId" component={PullRequestDetail} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/code-explain" component={CodeExplain} />
      <Route path="/ai-reviews" component={History} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}>
          <OAuthTokenHandler>
            <Router />
          </OAuthTokenHandler>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
