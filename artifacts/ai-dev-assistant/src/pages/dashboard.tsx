import React from "react";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetCommitActivity,
  useGetPRMetrics,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, AlertTriangle, Bug, CheckCircle2, GitPullRequest, Search,
  ShieldAlert, GitCommit, GitMerge, Clock, Zap, RefreshCw,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthStatus(score: number | undefined): "green" | "yellow" | "red" | "default" {
  if (score === undefined) return "default";
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function riskStatus(score: number | undefined): "green" | "yellow" | "red" | "default" {
  if (score === undefined) return "default";
  if (score >= 70) return "red";
  if (score >= 40) return "yellow";
  return "green";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity({ limit: 10 });
  const { data: commitActivity, isLoading: isLoadingCommits } = useGetCommitActivity({ days: 30 });
  const { data: prMetrics } = useGetPRMetrics({ days: 30 });

  // ── Derived trend helpers ──────────────────────────────────────────────────
  const codeHealthTrend = summary?.codeHealth !== undefined
    ? summary.codeHealth >= 80 ? ("up" as const)
    : summary.codeHealth >= 60 ? ("neutral" as const)
    : ("down" as const)
    : undefined;

  const codeHealthLabel = summary?.codeHealth !== undefined
    ? summary.codeHealth >= 80 ? "Healthy codebase"
    : summary.codeHealth >= 60 ? "Moderate — room for improvement"
    : "Needs attention"
    : undefined;

  const riskTrend = summary?.avgRiskScore !== undefined && summary.avgRiskScore > 0
    ? summary.avgRiskScore >= 70 ? ("down" as const)
    : summary.avgRiskScore >= 40 ? ("neutral" as const)
    : ("up" as const)
    : undefined;

  const riskLabel = summary?.avgRiskScore !== undefined && summary.avgRiskScore > 0
    ? summary.avgRiskScore >= 70 ? "High risk — review urgently"
    : summary.avgRiskScore >= 40 ? "Moderate risk level"
    : "Low risk overall"
    : undefined;

  const highRiskCount = prMetrics?.byRiskLevel?.high ?? 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your connected repositories and recent activity.
          </p>
        </div>

        {/* ── KPI Grid ── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">

          {/* 1. Repositories Connected */}
          <KpiCard
            title="Repositories Connected"
            value={summary?.totalRepositories}
            icon={Search}
            isLoading={isLoadingSummary}
            href="/repositories"
            trend="neutral"
            trendLabel={summary?.totalRepositories ? `${summary.totalRepositories} repos synced` : undefined}
            statusColor="blue"
            emptyState="No repositories connected"
            tooltip="Click to view and manage all connected GitHub repositories"
          />

          {/* 2. Open PRs */}
          <KpiCard
            title="Open Pull Requests"
            value={summary?.totalOpenPRs ?? 0}
            icon={GitPullRequest}
            isLoading={isLoadingSummary}
            href="/repositories?filter=open-prs"
            trend={summary?.totalOpenPRs ? "neutral" : "up"}
            trendLabel={
              summary?.totalOpenPRs
                ? `${summary.totalOpenPRs} awaiting review`
                : "All PRs reviewed"
            }
            statusColor={summary?.totalOpenPRs && summary.totalOpenPRs > 5 ? "yellow" : "default"}
            emptyState="No open pull requests"
            tooltip="Click to view repositories with open pull requests sorted to the top"
          />

          {/* 3. AI Reviews */}
          <KpiCard
            title="AI Reviews Completed"
            value={summary?.reviewsCompleted ?? 0}
            icon={CheckCircle2}
            isLoading={isLoadingSummary}
            href="/ai-reviews"
            trend={summary?.reviewsCompleted ? "up" : "neutral"}
            trendLabel={summary?.reviewsCompleted ? `${summary.reviewsCompleted} total reviews run` : "No reviews yet"}
            statusColor="blue"
            emptyState="No AI reviews run yet"
            tooltip="Click to browse all AI review reports"
          />

          {/* 4. Code Health */}
          <KpiCard
            title="Code Health"
            value={summary?.codeHealth !== undefined ? `${summary.codeHealth}%` : undefined}
            icon={Activity}
            isLoading={isLoadingSummary}
            href="/analytics?tab=health"
            trend={codeHealthTrend}
            trendLabel={codeHealthLabel}
            statusColor={healthStatus(summary?.codeHealth)}
            emptyState="Run a review to measure health"
            tooltip="Click to view the full Health dashboard in Analytics"
          />

          {/* 5. Hours Saved */}
          <KpiCard
            title="Hours Saved (Est.)"
            value={summary?.hoursSaved ? `${summary.hoursSaved}h` : undefined}
            icon={Clock}
            isLoading={isLoadingSummary}
            href="/analytics?tab=productivity"
            trend={summary?.hoursSaved ? "up" : "neutral"}
            trendLabel={
              summary?.hoursSaved
                ? `≈${(summary.hoursSaved / 30).toFixed(1)}h saved per day avg`
                : undefined
            }
            statusColor="green"
            emptyState="Complete reviews to track time saved"
            tooltip="Click to view the Developer Productivity dashboard"
          />

          {/* 6. Bugs Detected */}
          <KpiCard
            title="Bugs Detected"
            value={summary?.bugsDetected ?? 0}
            icon={Bug}
            isLoading={isLoadingSummary}
            href="/ai-reviews?category=bugs"
            trend={summary?.bugsDetected && summary.bugsDetected > 0 ? "down" : "up"}
            trendLabel={
              summary?.bugsDetected && summary.bugsDetected > 0
                ? `${summary.bugsDetected} bug${summary.bugsDetected !== 1 ? "s" : ""} found in reviews`
                : "No bugs detected 🎉"
            }
            statusColor={summary?.bugsDetected && summary.bugsDetected > 0 ? "red" : "green"}
            emptyState="No bugs detected"
            tooltip="Click to view AI reviews filtered to Bug findings only"
          />

          {/* 7. Security Issues */}
          <KpiCard
            title="Security Issues"
            value={summary?.securityIssues ?? 0}
            icon={ShieldAlert}
            isLoading={isLoadingSummary}
            href="/ai-reviews?category=security"
            trend={summary?.securityIssues && summary.securityIssues > 0 ? "down" : "up"}
            trendLabel={
              summary?.securityIssues && summary.securityIssues > 0
                ? `${summary.securityIssues} vulnerabilit${summary.securityIssues !== 1 ? "ies" : "y"} found`
                : "No security issues 🎉"
            }
            statusColor={summary?.securityIssues && summary.securityIssues > 0 ? "red" : "green"}
            emptyState="No security issues found"
            tooltip="Click to view AI reviews filtered to Security findings only"
          />

          {/* 8. Performance Suggestions */}
          <KpiCard
            title="Performance Suggestions"
            value={summary?.performanceSuggestions ?? 0}
            icon={Zap}
            isLoading={isLoadingSummary}
            href="/analytics?tab=performance"
            trend={summary?.performanceSuggestions && summary.performanceSuggestions > 0 ? "neutral" : "up"}
            trendLabel={
              summary?.performanceSuggestions && summary.performanceSuggestions > 0
                ? `${summary.performanceSuggestions} improvement${summary.performanceSuggestions !== 1 ? "s" : ""} flagged`
                : "No performance issues"
            }
            statusColor="blue"
            emptyState="No performance suggestions yet"
            tooltip="Click to view Performance analytics and bottleneck breakdown"
          />

          {/* 9. Refactoring Suggestions */}
          <KpiCard
            title="Refactoring Suggestions"
            value={summary?.refactoringSuggestions ?? 0}
            icon={RefreshCw}
            isLoading={isLoadingSummary}
            href="/ai-reviews?category=refactoring"
            trend="neutral"
            trendLabel={
              summary?.refactoringSuggestions && summary.refactoringSuggestions > 0
                ? `${summary.refactoringSuggestions} refactor${summary.refactoringSuggestions !== 1 ? "s" : ""} recommended`
                : "Code looks clean"
            }
            statusColor="default"
            emptyState="No refactoring recommendations"
            tooltip="Click to view AI reviews filtered to Refactoring suggestions"
          />

          {/* 10. Average Risk Score */}
          <KpiCard
            title="Avg PR Risk Score"
            value={summary?.avgRiskScore ? `${summary.avgRiskScore}/100` : undefined}
            icon={AlertTriangle}
            isLoading={isLoadingSummary}
            href="/ai-reviews?sort=risk-desc"
            trend={riskTrend}
            trendLabel={riskLabel ?? (highRiskCount > 0 ? `${highRiskCount} high-risk PRs` : undefined)}
            statusColor={riskStatus(summary?.avgRiskScore)}
            emptyState="No PRs analyzed yet"
            tooltip="Click to view all AI reviews sorted by highest risk first"
          />
        </div>

        {/* ── Bottom charts ── */}
        <div className="grid gap-6 md:grid-cols-7">
          {/* Commit Activity */}
          <Card className="md:col-span-4 bg-card/50 backdrop-blur-sm border-muted">
            <CardHeader>
              <CardTitle>Commit Activity (30 Days)</CardTitle>
              <CardDescription>Daily commit volume across all repositories</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCommits ? (
                <Skeleton className="h-[300px] w-full" />
              ) : Array.isArray(commitActivity) && commitActivity.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={commitActivity} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCommits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(val) => format(new Date(val), "MMM dd")}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          color: "hsl(var(--foreground))",
                        }}
                        labelFormatter={(val) => format(new Date(val), "MMM dd, yyyy")}
                      />
                      <Area
                        type="monotone"
                        dataKey="commits"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCommits)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-lg border-muted">
                  <GitCommit className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No commit activity in the last 30 days</p>
                  <p className="text-xs text-muted-foreground/60">Push commits to see your activity chart</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="md:col-span-3 bg-card/50 backdrop-blur-sm border-muted">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest events from your team</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActivity ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-start gap-4">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : Array.isArray(recentActivity) && recentActivity.length > 0 ? (
                <div className="space-y-5">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 border border-border shrink-0">
                        <AvatarImage src={activity.actorAvatarUrl} alt={activity.actorLogin} />
                        <AvatarFallback>{(activity.actorLogin ?? "US").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">
                          <span className="text-primary">{activity.actorLogin}</span>{" "}
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ActivityIcon type={activity.type} />
                          <span className="truncate">{activity.repoName}</span>
                          <span>•</span>
                          {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-lg border-muted">
                  <Activity className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                  <p className="text-xs text-muted-foreground/60">Activity appears here as your team opens and merges PRs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

// ─── Activity icon ────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "pr_opened":        return <GitPullRequest className="h-3 w-3 text-blue-500" />;
    case "pr_merged":        return <GitMerge className="h-3 w-3 text-purple-500" />;
    case "pr_closed":        return <CheckCircle2 className="h-3 w-3 text-gray-500" />;
    case "review_completed": return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    case "risk_flagged":     return <ShieldAlert className="h-3 w-3 text-destructive" />;
    case "commit_pushed":    return <GitCommit className="h-3 w-3 text-primary" />;
    default:                 return <Activity className="h-3 w-3 text-muted-foreground" />;
  }
}
