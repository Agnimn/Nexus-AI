import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
