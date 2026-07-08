import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, pullRequestsTable, developerCommitsTable, activityItemsTable, aiReviewsTable } from "@workspace/db";
import { eq, and, desc, sql, count, avg, notInArray, inArray } from "drizzle-orm";
import { getGithubToken, getGithubRepos, getGithubCommits, getGithubPRs } from "../lib/github";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/repositories", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const token = await getGithubToken(userId);
  if (!token) {
    res.status(401).json({ error: "No GitHub token" });
    return;
  }

  try {
    const githubRepos = await getGithubRepos(token);
    const githubIds = githubRepos.slice(0, 50).map(r => String(r.id));

    for (const ghRepo of githubRepos.slice(0, 50)) {
      const existing = await db.select({ id: repositoriesTable.id })
        .from(repositoriesTable)
        .where(eq(repositoriesTable.githubId, String(ghRepo.id)));

      if (existing.length === 0) {
        await db.insert(repositoriesTable).values({
          userId,
          githubId: String(ghRepo.id),
          name: ghRepo.name,
          fullName: ghRepo.full_name,
          description: ghRepo.description,
          language: ghRepo.language,
          stars: ghRepo.stargazers_count,
          forks: ghRepo.forks_count,
          openPRs: ghRepo.open_issues_count,
        });
      } else {
        await db.update(repositoriesTable).set({
          name: ghRepo.name,
          fullName: ghRepo.full_name,
          description: ghRepo.description,
          language: ghRepo.language,
          stars: ghRepo.stargazers_count,
          forks: ghRepo.forks_count,
          openPRs: ghRepo.open_issues_count,
          updatedAt: new Date(),
        }).where(eq(repositoriesTable.githubId, String(ghRepo.id)));
      }
    }

    // Remove repos the user has deleted from GitHub (respecting FK chain)
    const reposToDelete = await db.select({ id: repositoriesTable.id })
      .from(repositoriesTable)
      .where(and(
        eq(repositoriesTable.userId, userId),
        githubIds.length > 0
          ? notInArray(repositoriesTable.githubId, githubIds)
          : sql`true`,
      ));

    if (reposToDelete.length > 0) {
      const repoIdsToDelete = reposToDelete.map(r => r.id);

      // Delete ai_reviews → pull_requests → repositories (FK order)
      const prsToDelete = await db.select({ id: pullRequestsTable.id })
        .from(pullRequestsTable)
        .where(inArray(pullRequestsTable.repoId, repoIdsToDelete));

      if (prsToDelete.length > 0) {
        const prIdsToDelete = prsToDelete.map(p => p.id);
        await db.delete(aiReviewsTable).where(inArray(aiReviewsTable.prId, prIdsToDelete));
        await db.delete(pullRequestsTable).where(inArray(pullRequestsTable.id, prIdsToDelete));
      }

      await db.delete(repositoriesTable).where(inArray(repositoriesTable.id, repoIdsToDelete));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to sync GitHub repos");
  }

  const repos = await db.select().from(repositoriesTable)
    .where(eq(repositoriesTable.userId, userId))
    .orderBy(desc(repositoriesTable.updatedAt));

  // Fetch AI review stats per repo (review count + latest health/risk scores)
  const repoIds = repos.map(r => r.id);
  const repoReviewStats: Record<number, { reviewCount: number; latestRiskScore: number | null; latestHealthScore: number | null }> = {};

  for (const repoId of repoIds) {
    const reviews = await db.select({
      id: aiReviewsTable.id,
      riskScore: aiReviewsTable.riskScore,
      overallScore: aiReviewsTable.overallScore,
      createdAt: aiReviewsTable.createdAt,
    }).from(aiReviewsTable)
      .where(eq(aiReviewsTable.repositoryId, repoId))
      .orderBy(desc(aiReviewsTable.createdAt))
      .limit(20);

    const latest = reviews[0];
    repoReviewStats[repoId] = {
      reviewCount: reviews.length,
      latestRiskScore: latest?.riskScore ?? null,
      latestHealthScore: latest?.overallScore ?? null,
    };
  }

  res.json(repos.map(r => ({
    id: r.id,
    githubId: r.githubId,
    name: r.name,
    fullName: r.fullName,
    description: r.description,
    language: r.language,
    stars: r.stars,
    forks: r.forks,
    openPRs: r.openPRs,
    lastAnalyzedAt: r.lastAnalyzedAt,
    createdAt: r.createdAt,
    reviewCount: repoReviewStats[r.id]?.reviewCount ?? 0,
    latestRiskScore: repoReviewStats[r.id]?.latestRiskScore ?? null,
    latestHealthScore: repoReviewStats[r.id]?.latestHealthScore ?? null,
  })));
});


router.get("/repositories/:repoId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));

  if (repos.length === 0) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  const r = repos[0]!;
  res.json({
    id: r.id,
    githubId: r.githubId,
    name: r.name,
    fullName: r.fullName,
    description: r.description,
    language: r.language,
    stars: r.stars,
    forks: r.forks,
    openPRs: r.openPRs,
    lastAnalyzedAt: r.lastAnalyzedAt,
    createdAt: r.createdAt,
  });
});

router.get("/repositories/:repoId/stats", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));

  if (repos.length === 0) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  const repo = repos[0]!;
  const token = await getGithubToken(userId);

  if (token) {
    try {
      const [owner, repoName] = repo.fullName.split("/");
      if (owner && repoName) {
        // Sync commits
        const commits = await getGithubCommits(token, owner, repoName);
        for (const c of commits) {
          const existing = await db.select({ id: developerCommitsTable.id })
            .from(developerCommitsTable)
            .where(and(eq(developerCommitsTable.repoId, repoId), eq(developerCommitsTable.sha, c.sha)));

          const commitData = {
            repoId,
            authorLogin: c.author?.login ?? c.commit.author.name ?? "unknown",
            authorAvatarUrl: c.author?.avatar_url ?? "",
            sha: c.sha,
            message: c.commit.message,
            additions: c.stats?.additions ?? 0,
            deletions: c.stats?.deletions ?? 0,
            committedAt: new Date(c.commit.author.date),
          };

          if (existing.length === 0) {
            await db.insert(developerCommitsTable).values(commitData);
          } else {
            await db.update(developerCommitsTable).set(commitData)
              .where(eq(developerCommitsTable.id, existing[0]!.id));
          }
        }

        // Sync merged + closed PRs so we have real mergedAt timestamps for merge time calculation
        try {
          const closedPRs = await getGithubPRs(token, owner, repoName, "closed");
          for (const ghPR of closedPRs) {
            const prState = ghPR.merged_at ? "merged" : "closed";
            const existing = await db.select({ id: pullRequestsTable.id })
              .from(pullRequestsTable)
              .where(and(eq(pullRequestsTable.repoId, repoId), eq(pullRequestsTable.prNumber, ghPR.number)));

            const prData = {
              repoId,
              prNumber: ghPR.number,
              title: ghPR.title,
              body: ghPR.body ?? null,
              state: prState,
              authorLogin: ghPR.user.login,
              authorAvatarUrl: ghPR.user.avatar_url,
              filesChanged: ghPR.changed_files ?? 0,
              additions: ghPR.additions ?? 0,
              deletions: ghPR.deletions ?? 0,
              mergedAt: ghPR.merged_at ? new Date(ghPR.merged_at) : null,
              updatedAt: new Date(ghPR.updated_at),
            };

            if (existing.length === 0) {
              await db.insert(pullRequestsTable).values({
                ...prData,
                createdAt: new Date(ghPR.created_at),
              });
            } else {
              await db.update(pullRequestsTable).set(prData)
                .where(eq(pullRequestsTable.id, existing[0]!.id));
            }
          }
        } catch (err) {
          req.log.warn({ err }, "Failed to sync closed/merged PRs for merge time");
        }
      }
    } catch (err) {
      req.log.error({ err }, "Failed to sync commits");
    }
  }

  const [totalCommitsRow] = await db.select({ count: count() }).from(developerCommitsTable)
    .where(eq(developerCommitsTable.repoId, repoId));

  const [totalPRsRow] = await db.select({ count: count() }).from(pullRequestsTable)
    .where(eq(pullRequestsTable.repoId, repoId));

  const [mergedPRsRow] = await db.select({ count: count() }).from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.repoId, repoId), eq(pullRequestsTable.state, "merged")));

  const [avgRiskRow] = await db.select({ avg: avg(pullRequestsTable.riskScore) }).from(pullRequestsTable)
    .where(eq(pullRequestsTable.repoId, repoId));

  const contributorRows = await db.select({
    login: developerCommitsTable.authorLogin,
    commits: count(),
  }).from(developerCommitsTable)
    .where(eq(developerCommitsTable.repoId, repoId))
    .groupBy(developerCommitsTable.authorLogin)
    .orderBy(desc(count()))
    .limit(5);

  const mergedPRs = await db.select().from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.repoId, repoId), eq(pullRequestsTable.state, "merged")));

  let totalMergeTimeHours = 0;
  let mergedPRsWithDatesCount = 0;

  for (const pr of mergedPRs) {
    if (pr.mergedAt && pr.createdAt) {
      const created = new Date(pr.createdAt).getTime();
      const merged = new Date(pr.mergedAt).getTime();
      const hours = (merged - created) / (1000 * 60 * 60);
      if (hours > 0) {
        totalMergeTimeHours += hours;
        mergedPRsWithDatesCount++;
      }
    }
  }

  const avgMergeTimeHours = mergedPRsWithDatesCount > 0
    ? Math.round(totalMergeTimeHours / mergedPRsWithDatesCount)
    : null;

  res.json({
    repoId,
    totalCommits: totalCommitsRow?.count ?? 0,
    totalPRs: totalPRsRow?.count ?? 0,
    mergedPRs: mergedPRsRow?.count ?? 0,
    avgMergeTimeHours,
    avgRiskScore: parseFloat(avgRiskRow?.avg ?? "0") || 0,
    bugFrequency: 0.15,
    topContributors: contributorRows.map(c => ({ login: c.login, commits: c.commits })),
  });
});

export default router;
