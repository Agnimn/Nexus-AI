import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, pullRequestsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getGithubToken, getGithubPRs, getGithubPR } from "../lib/github";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function mapPR(pr: any) {
  return {
    id: pr.id,
    repoId: pr.repoId,
    prNumber: pr.prNumber,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    authorLogin: pr.authorLogin,
    authorAvatarUrl: pr.authorAvatarUrl,
    filesChanged: pr.filesChanged,
    additions: pr.additions,
    deletions: pr.deletions,
    riskScore: pr.riskScore,
    riskLevel: pr.riskLevel,
    hasReview: Boolean(pr.hasReview),
    reviewStatus: pr.reviewStatus,
    mergedAt: pr.mergedAt,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  };
}

router.get("/repositories/:repoId/pull-requests", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");
  const state = (req.query.state as string) ?? "open";

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
        const ghPRs = await getGithubPRs(token, owner, repoName, state === "all" ? "all" : state);
        for (const ghPR of ghPRs) {
          const existing = await db.select({
            id: pullRequestsTable.id,
            additions: pullRequestsTable.additions,
          })
            .from(pullRequestsTable)
            .where(and(eq(pullRequestsTable.repoId, repoId), eq(pullRequestsTable.prNumber, ghPR.number)));

          const prState = ghPR.merged_at ? "merged" : ghPR.state;

          let additions = ghPR.additions;
          let deletions = ghPR.deletions;
          let filesChanged = ghPR.changed_files;

          if (existing.length === 0 || existing[0]!.additions === 0 || additions === undefined || deletions === undefined || filesChanged === undefined) {
            try {
              const detailedPR = await getGithubPR(token, owner, repoName, ghPR.number);
              additions = detailedPR.additions;
              deletions = detailedPR.deletions;
              filesChanged = detailedPR.changed_files;
            } catch (err) {
              req.log.warn({ err, number: ghPR.number }, "Failed to get detailed PR info");
            }
          }

          const prData = {
            repoId,
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
      }
    } catch (err) {
      req.log.error({ err }, "Failed to sync GitHub PRs");
    }
  }

  let query = db.select().from(pullRequestsTable).where(eq(pullRequestsTable.repoId, repoId));

  const prs = await db.select().from(pullRequestsTable)
    .where(eq(pullRequestsTable.repoId, repoId))
    .orderBy(desc(pullRequestsTable.createdAt));

  const filtered = state === "all" ? prs : prs.filter(p => p.state === state);
  res.json(filtered.map(mapPR));
});

router.get("/repositories/:repoId/pull-requests/:prId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");
  const prId = parseInt(req.params.prId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));

  if (repos.length === 0) {
    res.status(404).json({ error: "Repository not found" });
    return;
  }

  const prs = await db.select().from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.id, prId), eq(pullRequestsTable.repoId, repoId)));

  if (prs.length === 0) {
    res.status(404).json({ error: "Pull request not found" });
    return;
  }

  res.json(mapPR(prs[0]!));
});

export default router;
