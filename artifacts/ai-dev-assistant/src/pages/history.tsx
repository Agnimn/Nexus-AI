import React, { useState, useMemo } from "react";
import { useListReviews, useDeleteReview } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Calendar, GitPullRequest, Folder, ShieldAlert, Bug,
  Trash2, Download, FileText, AlertTriangle, Award, Zap, RefreshCw,
  Clock, Database, TrendingDown, SortDesc,
} from "lucide-react";

// ─── Category filter config ───────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all",         label: "All Reviews",   icon: Database,      color: "" },
  { id: "bugs",        label: "Bugs",          icon: Bug,           color: "text-red-400" },
  { id: "security",    label: "Security",      icon: ShieldAlert,   color: "text-amber-400" },
  { id: "performance", label: "Performance",   icon: Zap,           color: "text-sky-400" },
  { id: "refactoring", label: "Refactoring",   icon: RefreshCw,     color: "text-violet-400" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function syncParam(name: string, value: string) {
  const url = new URL(window.location.href);
  if (!value || value === "all" || value === "date-desc") {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }
  window.history.replaceState({}, "", url.toString());
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function History() {
  const { toast } = useToast();

  // ── Filters (initialised from URL query params for deep-linking) ──────────
  const [search, setSearch]               = useState(() => readParam("search"));
  const [riskFilter, setRiskFilter]       = useState(() => readParam("risk") || "all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryId>(
    () => (readParam("category") as CategoryId) || "all"
  );
  const [sortBy, setSortBy]               = useState(() => readParam("sort") || "date-desc");
  const [selectedReview, setSelectedReview] = useState<any>(null);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: reviews, isLoading, refetch } = useListReviews({
    search: search || undefined,
    risk: riskFilter === "all" ? undefined : riskFilter,
    page: 1,
    limit: 100, // fetch more so client-side filtering has full data
  });

  const deleteMutation = useDeleteReview();

  // ── Client-side filtering & sorting ──────────────────────────────────────
  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    let result = [...reviews];

    if (categoryFilter === "bugs")        result = result.filter(r => (r.bugs as any[])?.length > 0);
    if (categoryFilter === "security")    result = result.filter(r => (r.securityIssues as any[])?.length > 0);
    if (categoryFilter === "performance") result = result.filter(r => (r.performance as any[])?.length > 0);
    if (categoryFilter === "refactoring") result = result.filter(r => (r.refactoring as any[])?.length > 0);

    if (sortBy === "risk-desc") result.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    if (sortBy === "score-desc") result.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

    return result;
  }, [reviews, categoryFilter, sortBy]);

  // Count per category for pill badges
  const categoryCounts = useMemo(() => {
    if (!reviews) return {} as Record<CategoryId, number>;
    return {
      all:         reviews.length,
      bugs:        reviews.filter(r => (r.bugs as any[])?.length > 0).length,
      security:    reviews.filter(r => (r.securityIssues as any[])?.length > 0).length,
      performance: reviews.filter(r => (r.performance as any[])?.length > 0).length,
      refactoring: reviews.filter(r => (r.refactoring as any[])?.length > 0).length,
    } as Record<CategoryId, number>;
  }, [reviews]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: CategoryId) => {
    setCategoryFilter(cat);
    syncParam("category", cat);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    syncParam("sort", sort);
  };

  const handleRiskChange = (risk: string) => {
    setRiskFilter(risk);
    syncParam("risk", risk);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this review report?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Review Deleted", description: "The AI Review report was deleted." });
      refetch();
    } catch {
      toast({ title: "Delete Failed", description: "Failed to delete the review.", variant: "destructive" });
    }
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = (review: any) => {
    downloadFile(
      review.reviewText || `# AI Review for ${review.repositoryName}\n\nSummary: ${review.summary}`,
      `ai-review-${review.id}.md`, "text/markdown"
    );
  };

  const exportJson = (review: any) =>
    downloadFile(JSON.stringify(review, null, 2), `ai-review-${review.id}.json`, "application/json");

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">High Risk ({score})</Badge>;
    if (score >= 40) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium Risk ({score})</Badge>;
    return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Low Risk ({score})</Badge>;
  };

  const getScoreBadge = (score: number | undefined) => {
    const val = score ?? 75;
    if (val >= 85) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono font-bold">{val}/100</Badge>;
    if (val >= 70) return <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 font-mono font-bold">{val}/100</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono font-bold">{val}/100</Badge>;
  };

  const activeCategoryConfig = CATEGORIES.find(c => c.id === categoryFilter)!;
  const isSortedByRisk = sortBy === "risk-desc";

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" /> AI Review History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Browse, filter, and manage all automated AI review reports.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSortedByRisk && (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Sorted by highest risk
              </Badge>
            )}
            <Button onClick={() => refetch()} variant="outline" size="sm" className="flex items-center gap-2 border-muted hover:bg-muted/50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* ── Category Filter Pills ── */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            const isActive = categoryFilter === cat.id;
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(59,130,246,0.25)]"
                    : "bg-card/40 text-muted-foreground border-muted hover:border-primary/40 hover:text-foreground",
                ].join(" ")}
              >
                <CatIcon className={`h-3 w-3 ${isActive ? "" : cat.color}`} />
                {cat.label}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20" : "bg-muted"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Search + Risk + Sort row ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repository names..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card/40 border-muted placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <Select value={riskFilter} onValueChange={handleRiskChange}>
            <SelectTrigger className="w-[160px] bg-card/40 border-muted">
              <SelectValue placeholder="Risk level" />
            </SelectTrigger>
            <SelectContent className="bg-card border-muted text-foreground">
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
              <SelectItem value="medium">Medium Risk</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[170px] bg-card/40 border-muted">
              <SortDesc className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-card border-muted text-foreground">
              <SelectItem value="date-desc">Newest First</SelectItem>
              <SelectItem value="risk-desc">Highest Risk First</SelectItem>
              <SelectItem value="score-desc">Best Score First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Active filter context banner ── */}
        {(categoryFilter !== "all" || isSortedByRisk) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
            <activeCategoryConfig.icon className={`h-4 w-4 ${activeCategoryConfig.color || "text-primary"}`} />
            <span>
              Showing <strong className="text-foreground">{filteredReviews.length}</strong> review{filteredReviews.length !== 1 ? "s" : ""}{" "}
              {categoryFilter !== "all" && <>with <strong className="text-foreground">{activeCategoryConfig.label}</strong> findings</>}
              {isSortedByRisk && <>, sorted by <strong className="text-foreground">highest risk first</strong></>}
            </span>
            <button
              onClick={() => { handleCategoryChange("all"); handleSortChange("date-desc"); }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── Review cards grid ── */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
          </div>
        ) : filteredReviews.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredReviews.map(review => (
              <Card
                key={review.id}
                onClick={() => setSelectedReview(review)}
                className="bg-card/40 backdrop-blur-sm border-muted hover:border-primary/50 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 truncate">
                        <Folder className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{review.repositoryName}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : "Date N/A"}
                      </CardDescription>
                    </div>
                    {getScoreBadge(review.overallScore)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-2 italic bg-muted/30 p-2.5 rounded-lg border border-border/30">
                    "{review.summary || "No review summary available."}"
                  </p>

                  {/* Category quick stats */}
                  <div className="flex flex-wrap gap-1.5">
                    {(review.bugs as any[])?.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                        <Bug className="h-3 w-3" /> {(review.bugs as any[]).length} bug{(review.bugs as any[]).length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {(review.securityIssues as any[])?.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        <ShieldAlert className="h-3 w-3" /> {(review.securityIssues as any[]).length} security
                      </span>
                    )}
                    {(review.performance as any[])?.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                        <Zap className="h-3 w-3" /> {(review.performance as any[]).length} perf
                      </span>
                    )}
                    {(review.refactoring as any[])?.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
                        <RefreshCw className="h-3 w-3" /> {(review.refactoring as any[]).length} refactor
                      </span>
                    )}
                    {review.pullRequestNumber && (
                      <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                        <GitPullRequest className="h-3 w-3" /> PR #{review.pullRequestNumber}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-muted/50">
                    {getRiskBadge(review.riskScore ?? 0)}
                    <Button
                      variant="ghost" size="icon"
                      onClick={e => handleDelete(review.id, e)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed rounded-xl border-muted flex flex-col items-center gap-3">
            {categoryFilter === "bugs" ? (
              <>
                <Bug className="h-10 w-10 text-emerald-500/40" />
                <h3 className="font-semibold text-lg text-foreground">No bugs detected 🎉</h3>
                <p className="text-sm text-muted-foreground">None of your reviews found any bugs. Great work!</p>
              </>
            ) : categoryFilter === "security" ? (
              <>
                <ShieldAlert className="h-10 w-10 text-emerald-500/40" />
                <h3 className="font-semibold text-lg text-foreground">No security issues found 🎉</h3>
                <p className="text-sm text-muted-foreground">Your codebase appears free of detected security vulnerabilities.</p>
              </>
            ) : categoryFilter === "performance" ? (
              <>
                <Zap className="h-10 w-10 text-sky-500/40" />
                <h3 className="font-semibold text-lg text-foreground">No performance suggestions</h3>
                <p className="text-sm text-muted-foreground">No performance bottlenecks were flagged in any review.</p>
              </>
            ) : categoryFilter === "refactoring" ? (
              <>
                <RefreshCw className="h-10 w-10 text-violet-500/40" />
                <h3 className="font-semibold text-lg text-foreground">Code looks clean</h3>
                <p className="text-sm text-muted-foreground">No refactoring suggestions found across your reviews.</p>
              </>
            ) : (
              <>
                <AlertTriangle className="h-10 w-10 text-amber-500/40" />
                <h3 className="font-semibold text-lg text-foreground">No reviews found</h3>
                <p className="text-sm text-muted-foreground">Try tweaking your search or run a new AI analysis on a repository.</p>
              </>
            )}
          </div>
        )}

        {/* ── Detail Modal ── */}
        <Dialog open={!!selectedReview} onOpenChange={open => !open && setSelectedReview(null)}>
          {selectedReview && (
            <DialogContent className="max-w-3xl bg-card border border-muted text-foreground max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl">
              <DialogHeader className="border-b border-muted pb-4">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <Folder className="h-6 w-6 text-primary" /> {selectedReview.repositoryName}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground flex flex-wrap gap-4 mt-2">
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {new Date(selectedReview.createdAt).toLocaleString()}</span>
                  {selectedReview.pullRequestNumber && <span className="flex items-center gap-1.5"><GitPullRequest className="h-4 w-4" /> PR #{selectedReview.pullRequestNumber}</span>}
                  {selectedReview.tokensUsed > 0 && <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-500" /> {selectedReview.tokensUsed} tokens</span>}
                  {selectedReview.reviewDuration > 0 && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-sky-400" /> {(selectedReview.reviewDuration / 1000).toFixed(1)}s</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="grid grid-cols-3 gap-4 bg-muted/30 p-3 rounded-lg border border-border/30 text-center">
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-mono">Complexity</span>
                    <span className="text-base font-semibold">{selectedReview.complexity || "Medium"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-mono">Risk Level</span>
                    <span className="text-base font-semibold capitalize">
                      {selectedReview.riskScore >= 70 ? "High" : selectedReview.riskScore >= 40 ? "Medium" : "Low"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground uppercase font-mono">Verdict Score</span>
                    <span className="text-base font-semibold text-primary">{selectedReview.overallScore ?? 75}/100</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">Executive Summary</h3>
                  <p className="text-sm leading-relaxed border-l-4 border-primary pl-3 italic">
                    "{selectedReview.summary || "No summary provided."}"
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {selectedReview.bugs?.length > 0 && <CategoryIssues title="🚨 Bugs & Logic Errors" items={selectedReview.bugs} variant="destructive" />}
                  {selectedReview.securityIssues?.length > 0 && <CategoryIssues title="🛡️ Security Vulnerabilities" items={selectedReview.securityIssues} variant="warning" />}
                  {selectedReview.performance?.length > 0 && <CategoryIssues title="⚡ Performance Bottlenecks" items={selectedReview.performance} variant="info" />}
                  {selectedReview.refactoring?.length > 0 && <CategoryIssues title="♻️ Refactoring Suggestions" items={selectedReview.refactoring} variant="default" />}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-muted">
                  <Button variant="outline" size="sm" onClick={() => exportJson(selectedReview)} className="flex items-center gap-1.5 border-muted hover:bg-muted">
                    <Download className="h-4 w-4" /> Export JSON
                  </Button>
                  <Button size="sm" onClick={() => exportMarkdown(selectedReview)} className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Export Markdown
                  </Button>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </Layout>
  );
}

// ─── CategoryIssues sub-component ─────────────────────────────────────────────

function CategoryIssues({ title, items, variant }: { title: string; items: any[]; variant: string }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div key={index} className="p-3 rounded-lg border border-muted bg-card/60 flex flex-col gap-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {variant === "destructive" ? <Bug className="h-4 w-4 text-red-500" /> : variant === "warning" ? <ShieldAlert className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-sky-400" />}
                {item.message}
              </span>
              <Badge className={variant === "destructive" ? "bg-red-500/10 text-red-500 border-red-500/20" : variant === "warning" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-sky-500/10 text-sky-500 border-sky-500/20"}>
                {item.severity ? item.severity.toUpperCase() : "INFO"}
              </Badge>
            </div>
            {item.file && <span className="text-xs font-mono text-muted-foreground">Location: {item.file} {item.line ? `(Line ${item.line})` : ""}</span>}
            {item.suggestion && (
              <div className="mt-1 text-xs text-muted-foreground bg-muted/40 p-2 rounded border border-border/30">
                <span className="font-semibold text-primary block mb-0.5">Recommended Fix:</span>
                <code>{item.suggestion}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
