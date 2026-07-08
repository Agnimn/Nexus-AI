import React from "react";
import { Link, useParams } from "wouter";
import { 
  useGetRepository, 
  useGetRepositoryStats, 
  useListPullRequests,
  getGetRepositoryQueryKey,
  getGetRepositoryStatsQueryKey,
  getListPullRequestsQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GitFork, GitPullRequest, Star, GitBranch, GitCommit, AlertTriangle, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function RepositoryDetail() {
  const params = useParams();
  const repoId = parseInt(params.repoId || "0", 10);

  const { data: repo, isLoading: isLoadingRepo } = useGetRepository(repoId, {
    query: { enabled: !!repoId, queryKey: getGetRepositoryQueryKey(repoId) }
  });

  const { data: stats, isLoading: isLoadingStats } = useGetRepositoryStats(repoId, {
    query: { enabled: !!repoId, queryKey: getGetRepositoryStatsQueryKey(repoId) }
  });

  const { data: prs, isLoading: isLoadingPRs } = useListPullRequests(repoId, { state: 'open', limit: 10 }, {
    query: { enabled: !!repoId, queryKey: getListPullRequestsQueryKey(repoId, { state: 'open', limit: 10 }) }
  });

  if (!repoId) return <Layout><div>Invalid Repository ID</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          {isLoadingRepo ? (
            <Skeleton className="h-10 w-1/3" />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <GitBranch className="h-8 w-8 text-primary" />
              {repo?.fullName}
              {repo?.language && <Badge variant="outline" className="text-xs font-mono ml-2">{repo.language}</Badge>}
            </h1>
          )}
          {isLoadingRepo ? (
            <Skeleton className="h-5 w-1/2" />
          ) : (
            <p className="text-muted-foreground">{repo?.description || "No description provided."}</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            title="Total Commits"
            value={stats?.totalCommits}
            icon={GitCommit}
            isLoading={isLoadingStats}
          />
          <MetricCard
            title="Open PRs"
            value={repo?.openPRs}
            icon={GitPullRequest}
            isLoading={isLoadingRepo}
          />
          <MetricCard
            title="Avg Risk Score"
            value={stats?.avgRiskScore ? `${stats.avgRiskScore.toFixed(1)}/100` : undefined}
            icon={ShieldAlert}
            isLoading={isLoadingStats}
            alert={stats?.avgRiskScore && stats.avgRiskScore > 60}
          />
          <MetricCard
            title="Avg Merge Time"
            value={stats?.avgMergeTimeHours ? `${stats.avgMergeTimeHours.toFixed(1)}h` : undefined}
            icon={Clock}
            isLoading={isLoadingStats}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 bg-card/50 backdrop-blur-sm border-muted">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Open Pull Requests</CardTitle>
                <CardDescription>Recent PRs pending review</CardDescription>
              </div>
              <Badge variant="secondary">{prs?.length || 0} Open</Badge>
            </CardHeader>
            <CardContent>
              {isLoadingPRs ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : prs && prs.length > 0 ? (
                <div className="space-y-4">
                  {prs.map(pr => (
                    <Link key={pr.id} href={`/repositories/${repoId}/pull-requests/${pr.prNumber}`}>
                      <div className="flex items-start justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className="flex gap-4">
                          <Avatar className="h-10 w-10 border border-border">
                            <AvatarImage src={pr.authorAvatarUrl} alt={pr.authorLogin} />
                            <AvatarFallback>{pr.authorLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {pr.title}
                              </h4>
                              <span className="text-xs text-muted-foreground font-mono">#{pr.prNumber}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Opened by {pr.authorLogin}</span>
                              {pr.createdAt && <span>• {format(new Date(pr.createdAt), 'MMM d, yyyy')}</span>}
                              <span className="flex items-center gap-1 text-green-500"><span className="text-green-500 font-bold">+</span>{pr.additions}</span>
                              <span className="flex items-center gap-1 text-red-500"><span className="text-red-500 font-bold">-</span>{pr.deletions}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <RiskBadge level={pr.riskLevel} score={pr.riskScore} />
                          {pr.reviewStatus === "completed" ? (
                            <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">Reviewed</Badge>
                          ) : pr.reviewStatus === "in_progress" ? (
                            <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10">Analyzing...</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg border-muted">
                  No open pull requests
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-muted h-fit">
            <CardHeader>
              <CardTitle>Top Contributors</CardTitle>
              <CardDescription>By commit volume</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : stats?.topContributors && stats.topContributors.length > 0 ? (
                <div className="space-y-4">
                  {stats.topContributors.map((contributor, i) => (
                    <div key={contributor.login} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-muted-foreground w-4">{i + 1}</div>
                        <span className="text-sm font-medium">{contributor.login}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono">{contributor.commits} commits</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No contributor data</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function MetricCard({ title, value, icon: Icon, isLoading, alert }: any) {
  return (
    <Card className={`bg-card/50 backdrop-blur-sm border-muted ${alert ? 'border-destructive/50 shadow-[0_0_15px_rgba(255,0,0,0.1)]' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className={`text-2xl font-bold ${alert ? 'text-destructive' : 'text-foreground'}`}>
            {value !== undefined ? value : '-'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level, score }: { level?: string, score?: number }) {
  if (!level) return <Badge variant="outline">Unassessed</Badge>;
  
  if (level === "low") {
    return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">Low Risk {score && `(${score})`}</Badge>;
  }
  if (level === "medium") {
    return <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">Medium Risk {score && `(${score})`}</Badge>;
  }
  return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">High Risk {score && `(${score})`}</Badge>;
}
