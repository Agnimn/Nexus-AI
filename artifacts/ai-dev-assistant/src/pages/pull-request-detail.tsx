import React, { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetPullRequest, 
  useGetPullRequestReview, 
  useGetPullRequestRisk, 
  useTriggerPullRequestReview,
  getGetPullRequestQueryKey,
  getGetPullRequestReviewQueryKey,
  getGetPullRequestRiskQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { GitPullRequest, CheckCircle2, AlertTriangle, ShieldAlert, Bot, Activity, ArrowRight, XCircle, Clock, Zap } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function PullRequestDetail() {
  const params = useParams();
  const repoId = parseInt(params.repoId || "0", 10);
  const prId = parseInt(params.prId || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pr, isLoading: isLoadingPR } = useGetPullRequest(repoId, prId, {
    query: { enabled: !!(repoId && prId), queryKey: getGetPullRequestQueryKey(repoId, prId) }
  });

  const { data: review, isLoading: isLoadingReview } = useGetPullRequestReview(repoId, prId, {
    query: { enabled: !!(repoId && prId), queryKey: getGetPullRequestReviewQueryKey(repoId, prId) }
  });

  const { data: risk, isLoading: isLoadingRisk } = useGetPullRequestRisk(repoId, prId, {
    query: { enabled: !!(repoId && prId), queryKey: getGetPullRequestRiskQueryKey(repoId, prId) }
  });

  const triggerReview = useTriggerPullRequestReview();

  const handleTriggerReview = () => {
    triggerReview.mutate({ repoId, prId }, {
      onSuccess: () => {
        toast({ title: "Analysis Started", description: "AI review process initiated." });
        // In a real app we'd poll or use websockets, here we just invalidate
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: getGetPullRequestReviewQueryKey(repoId, prId) });
          queryClient.invalidateQueries({ queryKey: getGetPullRequestRiskQueryKey(repoId, prId) });
          queryClient.invalidateQueries({ queryKey: getGetPullRequestQueryKey(repoId, prId) });
        }, 3000);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to trigger review.", variant: "destructive" });
      }
    });
  };

  if (!repoId || !prId) return <Layout><div>Invalid PR ID</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          {isLoadingPR ? (
            <Skeleton className="h-10 w-2/3" />
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  <GitPullRequest className="h-8 w-8 text-primary" />
                  {pr?.title} <span className="text-muted-foreground font-mono">#{pr?.prNumber}</span>
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={pr?.authorAvatarUrl} />
                      <AvatarFallback>{pr?.authorLogin?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{pr?.authorLogin}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {pr?.createdAt && format(new Date(pr.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-green-500">+{pr?.additions}</span>
                    <span className="text-red-500">-{pr?.deletions}</span>
                    <span className="text-muted-foreground">({pr?.filesChanged} files)</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PRStateBadge state={pr?.state} />
                {pr?.reviewStatus !== "completed" && (
                  <Button 
                    onClick={handleTriggerReview} 
                    disabled={triggerReview.isPending || pr?.reviewStatus === "in_progress"}
                    className="gap-2"
                  >
                    <Bot className="h-4 w-4" />
                    {pr?.reviewStatus === "in_progress" ? "Analyzing..." : "Trigger AI Review"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card/50 backdrop-blur-sm border-muted">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Analysis Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReview ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : review?.summary ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.summary}</p>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    No AI review available yet. Trigger an analysis to get insights.
                  </div>
                )}
              </CardContent>
            </Card>

            {(review?.bugs && review.bugs.length > 0) && (
              <IssueList title="Bugs Detected" issues={review.bugs} icon={AlertTriangle} color="text-red-500" bg="bg-red-500/10" border="border-red-500/30" />
            )}
            
            {(review?.performance && review.performance.length > 0) && (
              <IssueList title="Performance Issues" issues={review.performance} icon={Zap} color="text-amber-500" bg="bg-amber-500/10" border="border-amber-500/30" />
            )}

            {(review?.improvements && review.improvements.length > 0) && (
              <IssueList title="Suggested Improvements" issues={review.improvements} icon={CheckCircle2} color="text-blue-500" bg="bg-blue-500/10" border="border-blue-500/30" />
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-card/50 backdrop-blur-sm border-muted">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingRisk ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : risk ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center p-6 border rounded-lg border-muted bg-card">
                      <div className="text-5xl font-bold font-mono tracking-tighter mb-2 flex items-baseline">
                        {risk.riskScore}
                        <span className="text-xl text-muted-foreground ml-1">/100</span>
                      </div>
                      <RiskBadge level={risk.riskLevel} />
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">Risk Factors</h4>
                      {risk.factors.map((factor, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{factor.name}</span>
                            <span className="font-mono text-muted-foreground">{factor.value.toFixed(0)}% weight</span>
                          </div>
                          <Progress value={factor.value} className="h-1.5" />
                        </div>
                      ))}
                    </div>

                    {risk.prediction && (
                      <div className="text-sm p-3 rounded-md bg-muted/50 border border-muted">
                        <span className="font-semibold block mb-1">AI Prediction:</span>
                        {risk.prediction}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    Risk assessment not yet available.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-muted">
              <CardHeader>
                <CardTitle>Overall Quality</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingReview ? (
                  <Skeleton className="h-4 w-full" />
                ) : review?.overallScore ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium">
                      <span>Score</span>
                      <span className="font-mono">{review.overallScore}/100</span>
                    </div>
                    <Progress value={review.overallScore} className="h-2" />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No score available</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function IssueList({ title, issues, icon: Icon, color, bg, border }: any) {
  return (
    <Card className={`border-muted`}>
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          {title}
          <Badge variant="secondary" className="ml-auto">{issues.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 p-0">
        <div className="divide-y divide-border/50">
          {issues.map((issue: any, i: number) => (
            <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1 rounded-sm ${bg} ${border} border`}>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="text-sm font-medium leading-tight">{issue.message}</div>
                  
                  {issue.file && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-2 py-1 rounded">
                      <span>{issue.file}</span>
                      {issue.line && <span>:{issue.line}</span>}
                    </div>
                  )}

                  {issue.suggestion && (
                    <div className="text-sm text-muted-foreground mt-2 p-3 rounded-md bg-card border border-border">
                      <span className="font-semibold text-foreground block mb-1">Suggestion:</span>
                      <code className="text-xs font-mono">{issue.suggestion}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PRStateBadge({ state }: { state?: string }) {
  if (state === "open") return <Badge className="bg-green-500 hover:bg-green-600 text-white">Open</Badge>;
  if (state === "merged") return <Badge className="bg-purple-500 hover:bg-purple-600 text-white">Merged</Badge>;
  if (state === "closed") return <Badge className="bg-red-500 hover:bg-red-600 text-white">Closed</Badge>;
  return <Badge variant="outline">Unknown</Badge>;
}

function RiskBadge({ level }: { level?: string }) {
  if (!level) return null;
  if (level === "low") {
    return <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-sm px-3 py-1">Low Risk</Badge>;
  }
  if (level === "medium") {
    return <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-sm px-3 py-1">Medium Risk</Badge>;
  }
  return <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-sm px-3 py-1">High Risk</Badge>;
}
