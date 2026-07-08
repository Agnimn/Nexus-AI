import React, { useMemo } from "react";
import { Link } from "wouter";
import { useListRepositories, useTriggerRepositoryReview } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GitFork, GitPullRequest, Star, GitBranch, Clock, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function RepositoriesList() {
  const { data: repositories, isLoading } = useListRepositories();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const triggerReview = useTriggerRepositoryReview();

  // Read ?filter= from URL (set by dashboard "Open PRs" card)
  const [activeFilter] = React.useState(() => readParam("filter"));
  const isOpenPrsFilter = activeFilter === "open-prs";

  const displayRepos = useMemo(() => {
    if (!repositories || !Array.isArray(repositories)) return [];
    if (isOpenPrsFilter) {
      return [...repositories].sort((a, b) => (b.openPRs ?? 0) - (a.openPRs ?? 0));
    }
    return repositories;
  }, [repositories, isOpenPrsFilter]);

  const openPrRepoCount = useMemo(
    () => (repositories as any[] ?? []).filter((r: any) => (r.openPRs ?? 0) > 0).length,
    [repositories]
  );

  const handleAnalyze = async (repoId: number, repoName: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toast({ title: "Review Started", description: `AI is reviewing repository ${repoName}...` });
    try {
      await triggerReview.mutateAsync({ repoId });
      toast({ title: "Review Completed", description: `Successfully analyzed ${repoName}!` });
    } catch {
      toast({ title: "Review Failed", description: `Failed to review ${repoName}.`, variant: "destructive" });
    }
  };

  const handleViewReviews = (repoId: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setLocation(`/ai-reviews?repoId=${repoId}`);
  };

  const clearFilter = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("filter");
    window.history.replaceState({}, "", url.toString());
    window.location.reload();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Repositories</h1>
          <p className="text-muted-foreground text-sm">Manage and monitor connected GitHub repositories.</p>
        </div>

        {/* ── Active filter banner ── */}
        {isOpenPrsFilter && (
          <div className="flex flex-wrap items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 text-sm">
            <Filter className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-muted-foreground flex-1 min-w-0">
              Showing <strong className="text-foreground">{openPrRepoCount}</strong> repositor{openPrRepoCount !== 1 ? "ies" : "y"} with open pull requests — sorted by most open PRs first
            </span>
            <button
              onClick={clearFilter}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          </div>
        )}

        {/* ── Repository grid ── */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-[260px] w-full rounded-xl" />
            ))}
          </div>
        ) : displayRepos.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {displayRepos.map((repo: any) => {
              const hasOpenPRs = (repo.openPRs ?? 0) > 0;
              const isHighlighted = isOpenPrsFilter && hasOpenPRs;

              return (
                <Link key={repo.id} href={`/repositories/${repo.id}`}>
                  <Card className={[
                    "bg-card/50 backdrop-blur-sm border-muted hover:border-primary/50 transition-all duration-200 cursor-pointer h-full flex flex-col justify-between",
                    isHighlighted ? "border-amber-500/40 shadow-[0_0_14px_rgba(245,158,11,0.07)]" : "",
                  ].join(" ")}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <GitBranch className="h-5 w-5 text-primary shrink-0" />
                          <CardTitle className="text-base font-semibold truncate">{repo.name}</CardTitle>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isHighlighted && (
                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/25 text-[10px]">
                              {repo.openPRs} open PR{repo.openPRs !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {repo.language && (
                            <Badge variant="secondary" className="font-mono text-xs">{repo.language}</Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="line-clamp-2 mt-2 h-10 text-xs">
                        {repo.description || "No description provided."}
                      </CardDescription>

                      {/* AI stats badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {repo.latestHealthScore != null ? (
                          <Badge className={
                            repo.latestHealthScore >= 80
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                              : repo.latestHealthScore >= 60
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                              : "bg-red-500/10 text-red-500 border-red-500/20 text-xs"
                          }>
                            Health: {repo.latestHealthScore}/100
                          </Badge>
                        ) : (
                          <Badge className="bg-muted/30 text-muted-foreground border-muted text-xs">
                            Health: Not analyzed
                          </Badge>
                        )}

                        {repo.latestRiskScore != null ? (
                          <Badge className={
                            repo.latestRiskScore >= 70
                              ? "bg-red-500/10 text-red-500 border-red-500/20 text-xs"
                              : repo.latestRiskScore >= 40
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"
                              : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs"
                          }>
                            {repo.latestRiskScore >= 70 ? "High Risk" : repo.latestRiskScore >= 40 ? "Medium Risk" : "Low Risk"}
                          </Badge>
                        ) : (
                          <Badge className="bg-muted/30 text-muted-foreground border-muted text-xs">
                            Risk: N/A
                          </Badge>
                        )}

                        <Badge variant="outline" className="text-xs border-muted text-muted-foreground">
                          {repo.reviewCount ?? 0} review{(repo.reviewCount ?? 0) !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="mt-auto pt-4 border-t border-border/50 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1" title="Stars">
                            <Star className="h-4 w-4" />
                            <span>{repo.stars ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1" title="Forks">
                            <GitFork className="h-4 w-4" />
                            <span>{repo.forks ?? 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 ${hasOpenPRs ? "text-amber-400" : ""}`} title="Open PRs">
                            <GitPullRequest className="h-4 w-4" />
                            <span>{repo.openPRs ?? 0}</span>
                          </div>
                        </div>
                        {repo.lastAnalyzedAt && (
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(repo.lastAnalyzedAt), "MMM d, yyyy")}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          size="sm" variant="outline"
                          onClick={e => handleAnalyze(repo.id, repo.name, e)}
                          className="text-xs border-muted text-foreground hover:bg-muted"
                        >
                          Analyze Code
                        </Button>
                        <Button
                          size="sm"
                          onClick={e => handleViewReviews(repo.id, e)}
                          className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          View Reviews
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg border-muted gap-3">
            <GitBranch className="h-12 w-12 text-muted" />
            <h3 className="text-lg font-medium text-foreground">No repositories connected</h3>
            <p className="text-sm">Connect your GitHub account to start analyzing repositories.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
