import React, { useState, useMemo } from "react";
import {
  useGetDeveloperAnalytics,
  useGetCommitActivity,
  useGetPRMetrics,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area,
} from "recharts";
import {
  Activity, GitCommit, GitMerge, Bug, Clock, ShieldAlert, Zap,
  RefreshCw, TrendingUp, Award, BarChart2, HeartPulse, Users, Gauge,
} from "lucide-react";
import { format } from "date-fns";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",     label: "Overview",     icon: BarChart2 },
  { id: "health",       label: "Health",       icon: HeartPulse },
  { id: "productivity", label: "Productivity", icon: Users },
  { id: "performance",  label: "Performance",  icon: Gauge },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

function syncTab(tab: string) {
  const url = new URL(window.location.href);
  if (tab === "overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  window.history.replaceState({}, "", url.toString());
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function healthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function healthBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabId>(
    () => (readParam("tab") as TabId) || "overview"
  );

  const { data: analytics, isLoading: isLoadingAnalytics } = useGetDeveloperAnalytics({ days: 30 });
  const { data: prMetrics, isLoading: isLoadingMetrics } = useGetPRMetrics({ days: 30 });
  const { data: commitActivity, isLoading: isLoadingCommits } = useGetCommitActivity({ days: 30 });
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();

  const sortedAnalytics = analytics ? [...analytics].sort((a, b) => b.commits - a.commits) : [];

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    syncTab(tab);
  };

  // ── Derived health metrics ─────────────────────────────────────────────────
  const healthScore = summary?.codeHealth ?? 0;
  const bugScore    = Math.max(0, 100 - Math.min((summary?.bugsDetected ?? 0) * 3, 60));
  const secScore    = Math.max(0, 100 - Math.min((summary?.securityIssues ?? 0) * 8, 80));
  const perfScore   = Math.max(0, 100 - Math.min((summary?.performanceSuggestions ?? 0) * 4, 60));
  const refactorPct = summary?.refactoringSuggestions ?? 0;

  const healthBreakdown = [
    { name: "Code Quality", value: healthScore, fill: "#3b82f6" },
    { name: "Bug-Free",     value: bugScore,    fill: "#10b981" },
    { name: "Security",     value: secScore,    fill: "#f59e0b" },
    { name: "Performance",  value: perfScore,   fill: "#8b5cf6" },
  ];

  // ── Risk distribution ──────────────────────────────────────────────────────
  const riskPieData = [
    { name: "Low Risk",    value: prMetrics?.byRiskLevel?.low    ?? 0, fill: "#10b981" },
    { name: "Medium Risk", value: prMetrics?.byRiskLevel?.medium ?? 0, fill: "#f59e0b" },
    { name: "High Risk",   value: prMetrics?.byRiskLevel?.high   ?? 0, fill: "#ef4444" },
  ].filter(d => d.value > 0);

  // ── Hours saved breakdown ─────────────────────────────────────────────────
  const totalHours = summary?.hoursSaved ?? 0;
  const hoursPerReview = (summary?.reviewsCompleted ?? 0) > 0
    ? (totalHours / summary!.reviewsCompleted!).toFixed(1)
    : "0";

  // ── Performance / refactoring breakdown ───────────────────────────────────
  const suggestionData = [
    { name: "Performance", count: summary?.performanceSuggestions ?? 0 },
    { name: "Refactoring", count: summary?.refactoringSuggestions ?? 0 },
    { name: "Bugs",        count: summary?.bugsDetected ?? 0 },
    { name: "Security",    count: summary?.securityIssues ?? 0 },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Deep insights into code health, developer productivity, and codebase risk.
          </p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-xl border border-muted w-fit">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                ].join(" ")}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                                        */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SimpleMetric title="Avg Merge Time"    value={prMetrics ? `${prMetrics.avgMergeTimeHours.toFixed(1)}h` : undefined} icon={Clock}      isLoading={isLoadingMetrics} />
              <SimpleMetric title="Total PRs Merged"  value={prMetrics?.totalMerged}                                                icon={GitMerge}   isLoading={isLoadingMetrics} />
              <SimpleMetric title="Avg Review Time"   value={prMetrics ? `${prMetrics.avgReviewTimeHours.toFixed(1)}h` : undefined} icon={Activity}   isLoading={isLoadingMetrics} />
              <SimpleMetric title="High Risk PRs"     value={prMetrics?.byRiskLevel?.high ?? 0}                                    icon={ShieldAlert} isLoading={isLoadingMetrics} alert={(prMetrics?.byRiskLevel?.high ?? 0) > 0} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Developer leaderboard */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Developer Leaderboard</CardTitle>
                  <CardDescription>Ranked by commit volume (last 30 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAnalytics ? (
                    <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                  ) : sortedAnalytics.length > 0 ? (
                    <div className="space-y-3">
                      {sortedAnalytics.map((dev, i) => (
                        <div key={dev.login} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-muted-foreground w-5 text-center">{i + 1}</div>
                            <Avatar className="h-9 w-9 border border-border">
                              <AvatarImage src={dev.avatarUrl} alt={dev.login} />
                              <AvatarFallback>{dev.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-sm">{dev.login}</div>
                              <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                                <span className="flex items-center gap-1"><GitCommit className="h-3 w-3" />{dev.commits}</span>
                                <span className="flex items-center gap-1"><GitMerge className="h-3 w-3" />{dev.prsMerged}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${dev.avgRiskScore > 50 ? "text-red-500 border-red-500/30" : "text-emerald-500 border-emerald-500/30"}`}>
                            Risk: {dev.avgRiskScore.toFixed(0)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Users} message="No developer data" sub="Push commits to populate this leaderboard" />
                  )}
                </CardContent>
              </Card>

              {/* Code churn chart */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Code Churn by Developer</CardTitle>
                  <CardDescription>Lines added + removed across all commits</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAnalytics ? (
                    <Skeleton className="h-[340px] w-full" />
                  ) : sortedAnalytics.length > 0 ? (
                    <div className="h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedAnalytics} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis dataKey="login" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted))" }} />
                          <Bar dataKey="codeChurn" name="Code Churn" radius={[0, 4, 4, 0]}>
                            {sortedAnalytics.map((entry, i) => (
                              <Cell key={i} fill={entry.codeChurn > 500 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState icon={BarChart2} message="No churn data" sub="Open and merge pull requests to see churn stats" />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* HEALTH TAB                                                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "health" && (
          <div className="space-y-6">
            {/* Health score hero */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {healthBreakdown.map(item => (
                <Card key={item.name} className={`border bg-card/50 ${healthBg(item.value)}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{item.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingSummary ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className={`text-3xl font-bold ${healthColor(item.value)}`}>{item.value}%</div>
                        <div className="mt-2 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.value}%`, backgroundColor: item.fill }} />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Risk distribution pie */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>PR Risk Distribution</CardTitle>
                  <CardDescription>Breakdown of all analyzed pull requests by risk level</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingMetrics ? (
                    <Skeleton className="h-[280px] w-full" />
                  ) : riskPieData.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                            {riskPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                          <Legend />
                          <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState icon={ShieldAlert} message="No PR risk data" sub="Trigger AI reviews on pull requests to see risk distribution" />
                  )}
                </CardContent>
              </Card>

              {/* Health summary */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Health Summary</CardTitle>
                  <CardDescription>Issues found across all AI reviews</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingSummary ? (
                    <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : (
                    <>
                      {[
                        { label: "Bugs Detected",            value: summary?.bugsDetected ?? 0,            icon: Bug,         color: "text-red-400",    bg: "bg-red-500/10" },
                        { label: "Security Vulnerabilities",  value: summary?.securityIssues ?? 0,          icon: ShieldAlert, color: "text-amber-400",  bg: "bg-amber-500/10" },
                        { label: "Performance Suggestions",   value: summary?.performanceSuggestions ?? 0,  icon: Zap,         color: "text-sky-400",    bg: "bg-sky-500/10" },
                        { label: "Refactoring Suggestions",   value: summary?.refactoringSuggestions ?? 0,  icon: RefreshCw,   color: "text-violet-400", bg: "bg-violet-500/10" },
                      ].map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/40">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${bg}`}>
                              <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                          <span className={`text-lg font-bold ${value > 0 ? color : "text-emerald-400"}`}>
                            {value > 0 ? value : "✓"}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 text-xs text-muted-foreground text-center border-t border-muted/50">
                        Based on {summary?.reviewsCompleted ?? 0} completed AI review{(summary?.reviewsCompleted ?? 0) !== 1 ? "s" : ""}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PRODUCTIVITY TAB                                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "productivity" && (
          <div className="space-y-6">
            {/* Hours saved hero row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SimpleMetric title="Total Hours Saved"    value={totalHours ? `${totalHours}h` : undefined}               icon={Clock}      isLoading={isLoadingSummary} emptyState="Run reviews to track" />
              <SimpleMetric title="Reviews Completed"    value={summary?.reviewsCompleted ?? 0}                           icon={Award}      isLoading={isLoadingSummary} />
              <SimpleMetric title="Hours Saved / Review" value={Number(hoursPerReview) > 0 ? `${hoursPerReview}h` : undefined} icon={TrendingUp} isLoading={isLoadingSummary} emptyState="N/A" />
              <SimpleMetric title="Avg Merge Time"       value={prMetrics ? `${prMetrics.avgMergeTimeHours.toFixed(1)}h` : undefined} icon={GitMerge} isLoading={isLoadingMetrics} emptyState="No merges yet" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Commit activity area chart */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Commit Activity (30 Days)</CardTitle>
                  <CardDescription>Daily commit volume across all repositories</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingCommits ? (
                    <Skeleton className="h-[280px] w-full" />
                  ) : Array.isArray(commitActivity) && commitActivity.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={commitActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCommits2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tickFormatter={v => format(new Date(v), "MMM dd")} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} labelFormatter={v => format(new Date(v), "MMM dd, yyyy")} />
                          <Area type="monotone" dataKey="commits" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorCommits2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState icon={GitCommit} message="No commit data" sub="Push commits to see your activity trend" />
                  )}
                </CardContent>
              </Card>

              {/* PR stats */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Pull Request Stats</CardTitle>
                  <CardDescription>Merged, open, and closed PR distribution</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingMetrics ? (
                    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <>
                      {[
                        { label: "Merged PRs",  value: prMetrics?.totalMerged ?? 0,  color: "bg-violet-500",  pct: prMetrics?.totalMerged },
                        { label: "Open PRs",    value: prMetrics?.totalOpen ?? 0,    color: "bg-amber-500",   pct: prMetrics?.totalOpen },
                        { label: "Closed PRs",  value: prMetrics?.totalClosed ?? 0,  color: "bg-muted-foreground", pct: prMetrics?.totalClosed },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">{value}</span>
                          </div>
                          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${color} transition-all duration-500`}
                              style={{ width: `${Math.min(100, value * 5)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {prMetrics && (
                        <div className="pt-3 text-xs text-muted-foreground text-center border-t border-muted/50">
                          Avg review time: {prMetrics.avgReviewTimeHours.toFixed(1)}h per PR
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PERFORMANCE TAB                                                     */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SimpleMetric title="Performance Issues"    value={summary?.performanceSuggestions ?? 0}  icon={Zap}       isLoading={isLoadingSummary} alert={(summary?.performanceSuggestions ?? 0) > 5} />
              <SimpleMetric title="Refactoring Items"     value={summary?.refactoringSuggestions ?? 0}  icon={RefreshCw} isLoading={isLoadingSummary} />
              <SimpleMetric title="Bugs Found"            value={summary?.bugsDetected ?? 0}            icon={Bug}       isLoading={isLoadingSummary} alert={(summary?.bugsDetected ?? 0) > 0} />
              <SimpleMetric title="Security Findings"     value={summary?.securityIssues ?? 0}          icon={ShieldAlert} isLoading={isLoadingSummary} alert={(summary?.securityIssues ?? 0) > 0} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Suggestions bar chart */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Issue Category Breakdown</CardTitle>
                  <CardDescription>Total findings across all completed AI reviews</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSummary ? (
                    <Skeleton className="h-[280px] w-full" />
                  ) : suggestionData.some(d => d.count > 0) ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={suggestionData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                          <Bar dataKey="count" name="Issues" radius={[4, 4, 0, 0]}>
                            {suggestionData.map((_, i) => (
                              <Cell key={i} fill={["#8b5cf6","#6366f1","#ef4444","#f59e0b"][i]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyState icon={Zap} message="No issues detected" sub="All categories are clean across your reviews 🎉" />
                  )}
                </CardContent>
              </Card>

              {/* Performance tips */}
              <Card className="bg-card/50 backdrop-blur-sm border-muted">
                <CardHeader>
                  <CardTitle>Optimization Opportunities</CardTitle>
                  <CardDescription>Areas the AI flagged most frequently for improvement</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingSummary ? (
                    <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        {
                          title: "Performance",
                          desc: "Reduce N+1 queries, optimize loops, defer heavy computations",
                          count: summary?.performanceSuggestions ?? 0,
                          icon: Zap, color: "text-sky-400", bg: "bg-sky-500/10",
                        },
                        {
                          title: "Refactoring",
                          desc: "Extract reusable functions, reduce duplication, improve naming",
                          count: summary?.refactoringSuggestions ?? 0,
                          icon: RefreshCw, color: "text-violet-400", bg: "bg-violet-500/10",
                        },
                        {
                          title: "Bug Fixes",
                          desc: "Address null checks, edge cases, and logic errors",
                          count: summary?.bugsDetected ?? 0,
                          icon: Bug, color: "text-red-400", bg: "bg-red-500/10",
                        },
                        {
                          title: "Security Hardening",
                          desc: "Sanitize inputs, rotate secrets, add auth guards",
                          count: summary?.securityIssues ?? 0,
                          icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/10",
                        },
                      ].map(({ title, desc, count, icon: Icon, color, bg }) => (
                        <div key={title} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-card/40">
                          <div className={`p-1.5 rounded-md shrink-0 ${bg}`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold">{title}</span>
                              <Badge className={count > 0 ? `${bg} ${color} border-0` : "bg-emerald-500/10 text-emerald-400 border-0"}>
                                {count > 0 ? count : "✓ Clean"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SimpleMetric({ title, value, icon: Icon, isLoading, alert = false, emptyState = "—" }: {
  title: string; value?: string | number; icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean; alert?: boolean; emptyState?: string;
}) {
  return (
    <Card className={`bg-card/50 backdrop-blur-sm border-muted ${alert ? "border-destructive/40 shadow-[0_0_14px_rgba(239,68,68,0.08)]" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-7 w-20" /> : (
          <div className={`text-2xl font-bold ${alert ? "text-destructive" : "text-foreground"}`}>
            {value !== undefined && value !== null ? value : <span className="text-xs font-normal text-muted-foreground">{emptyState}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: React.ComponentType<{ className?: string }>; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground border border-dashed rounded-lg border-muted">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {sub && <p className="text-xs text-center max-w-48">{sub}</p>}
    </div>
  );
}
