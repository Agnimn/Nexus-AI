import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, pullRequestsTable, developerCommitsTable, activityItemsTable, aiReviewsTable } from "@workspace/db";
import { eq, desc, count, avg, sum, and, gte, sql } from "drizzle-orm";
import { getGithubToken, getGithubCommits, getGithubPRs, getGithubPR } from "../lib/github";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const lastSyncs = new Map<number, { time: number; promise?: Promise<void> }>();

async function syncGithubDataForUser(userId: number, log?: any) {
  const now = Date.now();
  const existing = lastSyncs.get(userId);

  if (existing?.promise) {
    await existing.promise;
    return;
  }

  // 15 seconds rate limiting per user to avoid hitting Github rate limits
  if (existing && now - existing.time < 15000) {
    return;
  }

  const promise = (async () => {
    const token = await getGithubToken(userId);
    if (!token) return;

    const userRepos = await db.select().from(repositoriesTable)
      .where(eq(repositoriesTable.userId, userId));

    if (userRepos.length === 0) return;

    await Promise.all(userRepos.map(async (repo) => {
      try {
        const [owner, repoName] = repo.fullName.split("/");
        if (!owner || !repoName) return;

        // 1. Sync Commits
        const commits = await getGithubCommits(token, owner, repoName);
        for (const c of commits) {
          const existingCommit = await db.select({ id: developerCommitsTable.id })
            .from(developerCommitsTable)
            .where(and(eq(developerCommitsTable.repoId, repo.id), eq(developerCommitsTable.sha, c.sha)));

          const commitData = {
            repoId: repo.id,
            authorLogin: c.author?.login ?? c.commit.author.name ?? "unknown",
            authorAvatarUrl: c.author?.avatar_url ?? "",
            sha: c.sha,
            message: c.commit.message,
            additions: c.stats?.additions ?? 0,
            deletions: c.stats?.deletions ?? 0,
            committedAt: new Date(c.commit.author.date),
          };

          if (existingCommit.length === 0) {
            await db.insert(developerCommitsTable).values(commitData);
          } else {
            await db.update(developerCommitsTable).set(commitData)
              .where(eq(developerCommitsTable.id, existingCommit[0]!.id));
          }
        }

        // 2. Sync PRs
        const ghPRs = await getGithubPRs(token, owner, repoName, "all");
        for (const ghPR of ghPRs) {
          const existingPR = await db.select({
            id: pullRequestsTable.id,
            additions: pullRequestsTable.additions,
          })
            .from(pullRequestsTable)
            .where(and(eq(pullRequestsTable.repoId, repo.id), eq(pullRequestsTable.prNumber, ghPR.number)));

          const prState = ghPR.merged_at ? "merged" : ghPR.state;

          let additions = ghPR.additions;
          let deletions = ghPR.deletions;
          let filesChanged = ghPR.changed_files;

          if (existingPR.length === 0 || existingPR[0]!.additions === 0 || additions === undefined || deletions === undefined || filesChanged === undefined) {
            try {
              const detailedPR = await getGithubPR(token, owner, repoName, ghPR.number);
              additions = detailedPR.additions;
              deletions = detailedPR.deletions;
              filesChanged = detailedPR.changed_files;
            } catch (err) {
              if (log) log.warn({ err, number: ghPR.number }, "Failed to get detailed PR in sync");
            }
          }

          const prData = {
            repoId: repo.id,
            prNumber: ghPR.number,
            title: ghPR.title,
            body: ghPR.body ?? null,
            state: prState,
            authorLogin: ghPR.user.login,
            authorAvatarUrl: ghPR.user.avatar_url,
            filesChanged: filesChanged ?? 0,
            additions: additions ?? 0,
            deletions: deletions ?? 0,
            mergedAt: ghPR.merged_at ? new Date(ghPR.merged_at) : null,
            updatedAt: new Date(ghPR.updated_at),
          };

          if (existingPR.length === 0) {
            await db.insert(pullRequestsTable).values({
              ...prData,
              createdAt: new Date(ghPR.created_at),
            });
          } else {
            await db.update(pullRequestsTable).set(prData)
              .where(eq(pullRequestsTable.id, existingPR[0]!.id));
          }
        }
      } catch (err) {
        if (log) log.error({ err, repoId: repo.id }, "Failed to sync repo data");
      }
    }));
  })();

  lastSyncs.set(userId, { time: now, promise });
  try {
    await promise;
  } finally {
    const current = lastSyncs.get(userId);
    if (current) {
      lastSyncs.set(userId, { time: current.time });
    }
  }
}

router.get("/analytics/dashboard", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // Sync latest commits and PRs from GitHub in real-time
  await syncGithubDataForUser(userId, req.log).catch((err) => {
    req.log.error({ err }, "Background sync failed");
  });

  const [repoCountRow] = await db.select({ count: count() }).from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId));

  const userRepos = await db.select({ id: repositoriesTable.id }).from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId));
  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) {
    res.json({
      totalRepositories: 0,
      totalOpenPRs: 0,
      reviewsCompleted: 0,
      avgRiskScore: 0,
      highRiskPRs: 0,
      bugsDetected: 0,
      securityIssues: 0,
      performanceSuggestions: 0,
      refactoringSuggestions: 0,
      avgAiScore: 0,
      codeHealth: 100,
      hoursSaved: 0,
      activeContributors: 0,
    });
    return;
  }

  const allPRs = await db.select().from(pullRequestsTable)
    .where(sql`${pullRequestsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`);

  const openPRs = allPRs.filter(p => p.state === "open").length;
  const highRiskPRs = allPRs.filter(p => p.riskLevel === "high").length;

  const completedReviews = await db.select().from(aiReviewsTable)
    .where(and(eq(aiReviewsTable.status, "completed"), eq(aiReviewsTable.userId, userId)));

  const bugsDetected = completedReviews.reduce((sum, r) => sum + (r.bugsFound ?? r.bugs?.length ?? 0), 0);
  const securityIssues = completedReviews.reduce((sum, r) => sum + (r.securityIssues?.length ?? 0), 0);
  const performanceSuggestions = completedReviews.reduce((sum, r) => sum + (r.performance?.length ?? 0), 0);
  const refactoringSuggestions = completedReviews.reduce((sum, r) => sum + (r.refactoring?.length ?? 0), 0);

  const totalScores = completedReviews.filter(r => r.overallScore != null).map(r => r.overallScore!);
  const avgAiScore = totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 80;

  const riskScores = allPRs.filter(p => p.riskScore != null).map(p => p.riskScore!);
  const avgRiskScore = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;

  const contributors = await db.select({ login: developerCommitsTable.authorLogin })
    .from(developerCommitsTable)
    .where(sql`${developerCommitsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(developerCommitsTable.authorLogin);

  const hoursSaved = completedReviews.length * 1.5;

  res.json({
    totalRepositories: repoCountRow?.count ?? 0,
    totalOpenPRs: openPRs,
    reviewsCompleted: completedReviews.length,
    avgRiskScore: Math.round(avgRiskScore),
    highRiskPRs,
    bugsDetected,
    securityIssues,
    performanceSuggestions,
    refactoringSuggestions,
    avgAiScore: Math.round(avgAiScore),
    codeHealth: Math.round(avgAiScore),
    hoursSaved: Math.round(hoursSaved),
    activeContributors: contributors.length,
  });
});

router.get("/analytics/developers", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // Sync latest commits and PRs from GitHub in real-time
  await syncGithubDataForUser(userId, req.log).catch((err) => {
    req.log.error({ err }, "Background sync failed in developers");
  });

  const repoId = req.query.repoId ? parseInt(req.query.repoId as string) : undefined;

  const userRepos = await db.select({ id: repositoriesTable.id }).from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId));
  const repoIds = repoId ? [repoId] : userRepos.map(r => r.id);

  if (repoIds.length === 0) { res.json([]); return; }

  const repoFilter = sql`${pullRequestsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`;
  const commitRepoFilter = sql`${developerCommitsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`;

  const prsByDev = await db.select({
    login: pullRequestsTable.authorLogin,
    avatarUrl: pullRequestsTable.authorAvatarUrl,
    prsOpened: count(),
    avgRisk: avg(pullRequestsTable.riskScore),
    linesAdded: sum(pullRequestsTable.additions),
    linesRemoved: sum(pullRequestsTable.deletions),
  }).from(pullRequestsTable)
    .where(repoFilter)
    .groupBy(pullRequestsTable.authorLogin, pullRequestsTable.authorAvatarUrl);

  const commitsByDev = await db.select({
    login: developerCommitsTable.authorLogin,
    avatarUrl: developerCommitsTable.authorAvatarUrl,
    commits: count(),
  }).from(developerCommitsTable)
    .where(commitRepoFilter)
    .groupBy(developerCommitsTable.authorLogin, developerCommitsTable.authorAvatarUrl);

  const mergedByDev = await db.select({
    login: pullRequestsTable.authorLogin,
    merged: count(),
  }).from(pullRequestsTable)
    .where(and(repoFilter, eq(pullRequestsTable.state, "merged")))
    .groupBy(pullRequestsTable.authorLogin);

  const devLogins = new Set([
    ...commitsByDev.map(c => c.login),
    ...prsByDev.map(p => p.login)
  ].filter(Boolean) as string[]);

  const result = Array.from(devLogins).map(login => {
    const commitData = commitsByDev.find(c => c.login === login);
    const prData = prsByDev.find(p => p.login === login);
    const mergeData = mergedByDev.find(m => m.login === login);

    const added = Number(prData?.linesAdded ?? 0);
    const removed = Number(prData?.linesRemoved ?? 0);
    const avgRisk = Math.round(parseFloat(prData?.avgRisk ?? "0") || 0);

    return {
      login,
      avatarUrl: commitData?.avatarUrl || prData?.avatarUrl || "",
      commits: commitData?.commits ?? 0,
      prsOpened: prData?.prsOpened ?? 0,
      prsMerged: mergeData?.merged ?? 0,
      bugFrequency: avgRisk > 60 ? 0.25 : avgRisk > 30 ? 0.1 : 0.03,
      avgRiskScore: avgRisk,
      codeChurn: added + removed,
      linesAdded: added,
      linesRemoved: removed,
    };
  });

  res.json(result.sort((a, b) => b.commits - a.commits));
});

router.get("/analytics/commits", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // Sync latest commits and PRs from GitHub in real-time
  await syncGithubDataForUser(userId, req.log).catch((err) => {
    req.log.error({ err }, "Background sync failed in commits");
  });

  const days = parseInt(req.query.days as string ?? "30");
  const repoId = req.query.repoId ? parseInt(req.query.repoId as string) : undefined;

  const userRepos = await db.select({ id: repositoriesTable.id }).from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId));
  const repoIds = repoId ? [repoId] : userRepos.map(r => r.id);

  if (repoIds.length === 0) { res.json([]); return; }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const commits = await db.select().from(developerCommitsTable)
    .where(and(
      sql`${developerCommitsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`,
      gte(developerCommitsTable.committedAt, since),
    ))
    .orderBy(developerCommitsTable.committedAt);

  const byDate = new Map<string, { commits: number; additions: number; deletions: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    byDate.set(key, { commits: 0, additions: 0, deletions: 0 });
  }

  for (const c of commits) {
    const key = c.committedAt.toISOString().split("T")[0]!;
    if (byDate.has(key)) {
      const existing = byDate.get(key)!;
      existing.commits++;
      existing.additions += c.additions;
      existing.deletions += c.deletions;
    }
  }

  res.json(Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data })));
});

router.get("/analytics/pr-metrics", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = req.query.repoId ? parseInt(req.query.repoId as string) : undefined;

  const userRepos = await db.select({ id: repositoriesTable.id }).from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId));
  const repoIds = repoId ? [repoId] : userRepos.map(r => r.id);

  if (repoIds.length === 0) {
    res.json({ avgMergeTimeHours: 0, avgReviewTimeHours: 0, totalMerged: 0, totalOpen: 0, totalClosed: 0, byRiskLevel: { low: 0, medium: 0, high: 0 } });
    return;
  }

  const allPRs = await db.select().from(pullRequestsTable)
    .where(sql`${pullRequestsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`);

  const merged = allPRs.filter(p => p.state === "merged");
  const mergedWithTimestamps = merged.filter(p => p.mergedAt);
  const avgMergeTime = mergedWithTimestamps.length > 0
    ? mergedWithTimestamps.reduce((acc, p) => {
        const created = p.createdAt.getTime();
        const mergedAt = p.mergedAt!.getTime();
        return acc + (mergedAt - created) / (1000 * 60 * 60);
      }, 0) / mergedWithTimestamps.length
    : 0;

  res.json({
    avgMergeTimeHours: Math.round(avgMergeTime),
    avgReviewTimeHours: Math.round(avgMergeTime * 0.6),
    totalMerged: allPRs.filter(p => p.state === "merged").length,
    totalOpen: allPRs.filter(p => p.state === "open").length,
    totalClosed: allPRs.filter(p => p.state === "closed").length,
    byRiskLevel: {
      low: allPRs.filter(p => p.riskLevel === "low").length,
      medium: allPRs.filter(p => p.riskLevel === "medium").length,
      high: allPRs.filter(p => p.riskLevel === "high").length,
    },
  });
});

router.get("/analytics/recent-activity", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const limit = parseInt(req.query.limit as string ?? "20");

  const userRepos = await db.select({ id: repositoriesTable.id, fullName: repositoriesTable.fullName })
    .from(repositoriesTable).where(eq(repositoriesTable.userId, userId));

  const repoIds = userRepos.map(r => r.id);

  if (repoIds.length === 0) { res.json([]); return; }

  const recentPRs = await db.select().from(pullRequestsTable)
    .where(sql`${pullRequestsTable.repoId} IN (${sql.join(repoIds.map(id => sql`${id}`), sql`, `)})`)
    .orderBy(desc(pullRequestsTable.createdAt))
    .limit(limit);

  const activities = recentPRs.map((pr, i) => {
    const repo = userRepos.find(r => r.id === pr.repoId);
    const type = pr.state === "merged" ? "pr_merged" : pr.state === "closed" ? "pr_closed" : "pr_opened";
    return {
      id: pr.id,
      type,
      repoName: repo?.fullName ?? "unknown/repo",
      actorLogin: pr.authorLogin,
      actorAvatarUrl: pr.authorAvatarUrl,
      title: pr.title,
      description: `${pr.additions} additions, ${pr.deletions} deletions across ${pr.filesChanged} files`,
      createdAt: pr.createdAt,
    };
  });

  res.json(activities.slice(0, limit));
});

export default router;
