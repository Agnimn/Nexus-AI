import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, pullRequestsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { runAiReview } from "./reviews";

const router = Router();

router.post("/webhooks/github", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "pull_request") {
    const action = payload.action;
    if (action === "opened" || action === "synchronize") {
      const prPayload = payload.pull_request;
      const ghRepoId = String(payload.repository.id);
      const prNumber = prPayload.number;

      // Find the repository in our DB
      const repos = await db.select().from(repositoriesTable).where(eq(repositoriesTable.githubId, ghRepoId));
      if (repos.length > 0) {
        const repo = repos[0]!;
        
        // Find or create the PR in our DB
        let prId: number;
        const existingPRs = await db.select().from(pullRequestsTable)
          .where(and(eq(pullRequestsTable.repoId, repo.id), eq(pullRequestsTable.prNumber, prNumber)));
        
        const prData = {
          repoId: repo.id,
          prNumber,
          title: prPayload.title,
          body: prPayload.body ?? null,
          state: prPayload.merged_at ? "merged" : prPayload.state,
          authorLogin: prPayload.user.login,
          authorAvatarUrl: prPayload.user.avatar_url,
          filesChanged: prPayload.changed_files ?? 0,
          additions: prPayload.additions ?? 0,
          deletions: prPayload.deletions ?? 0,
          mergedAt: prPayload.merged_at ? new Date(prPayload.merged_at) : null,
          updatedAt: new Date(prPayload.updated_at),
        };

        if (existingPRs.length > 0) {
          prId = existingPRs[0]!.id;
          await db.update(pullRequestsTable).set(prData).where(eq(pullRequestsTable.id, prId));
        } else {
          const [newPR] = await db.insert(pullRequestsTable).values({
            ...prData,
            createdAt: new Date(prPayload.created_at),
          }).returning();
          prId = newPR!.id;
        }

        // Trigger AI review asynchronously
        // We use the owner/creator's userId for fetching the tokens, which matches the repo's userId.
        runAiReview(prId, repo.id, repo.userId, req.log).catch((err) => {
          req.log.error({ err }, "Webhook AI review failed");
        });

        res.status(202).json({ success: true, message: "AI review triggered" });
        return;
      }
    }
  }

  res.json({ success: true, message: "Event ignored" });
});

export default router;
