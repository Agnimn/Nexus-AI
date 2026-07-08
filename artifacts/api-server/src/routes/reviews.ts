import { Router } from "express";
import { db } from "@workspace/db";
import { repositoriesTable, pullRequestsTable, aiReviewsTable } from "@workspace/db";
import { eq, and, desc, count, ilike, or, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  getGithubToken,
  getGithubPRFiles,
  getGithubRepoTree,
  getGithubFileContent
} from "../lib/github";
import { logger } from "../lib/logger";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function calculateRiskScore(pr: any, filesChanged: number, additions: number, deletions: number) {
  let score = 0;
  if (filesChanged > 20) score += 30;
  else if (filesChanged > 10) score += 20;
  else if (filesChanged > 5) score += 10;

  const totalChanges = additions + deletions;
  if (totalChanges > 500) score += 35;
  else if (totalChanges > 200) score += 20;
  else if (totalChanges > 100) score += 10;

  if (additions > 0 && deletions / additions > 0.5) score += 10;
  if (filesChanged > 0 && totalChanges / filesChanged > 50) score += 15;

  score = Math.min(100, score);
  return Math.round(score);
}

// ---------------------------------------------------------------------------
// AI Review Runner
// ---------------------------------------------------------------------------
export async function runAiReview(
  prId: number | undefined,
  repoId: number,
  userId: number,
  log: any = logger
) {
  const startTime = Date.now();

  const repos = await db.select().from(repositoriesTable).where(eq(repositoriesTable.id, repoId));
  if (repos.length === 0) throw new Error("Repository not found");
  const repo = repos[0]!;

  let pr: any = null;
  if (prId) {
    const prs = await db.select().from(pullRequestsTable)
      .where(and(eq(pullRequestsTable.id, prId), eq(pullRequestsTable.repoId, repoId)));
    if (prs.length === 0) throw new Error("PR not found");
    pr = prs[0]!;
  }

  // Insert initial review record
  const [newReview] = await db.insert(aiReviewsTable).values({
    prId: prId ?? null,
    repositoryId: repoId,
    repositoryName: repo.name,
    pullRequestNumber: pr?.prNumber ?? null,
    userId,
    status: "in_progress",
  }).returning();

  try {
    if (prId) {
      await db.update(pullRequestsTable).set({ hasReview: 1, reviewStatus: "in_progress" })
        .where(eq(pullRequestsTable.id, prId));
    }

    const token = await getGithubToken(userId);
    let codeContext = "";

    if (prId && pr) {
      codeContext = `PR Title: ${pr.title}\nPR Body: ${pr.body ?? "No description"}\nFiles changed: ${pr.filesChanged}\nAdditions: ${pr.additions}\nDeletions: ${pr.deletions}`;
      if (token) {
        try {
          const [owner, repoName] = repo.fullName.split("/");
          if (owner && repoName) {
            const files = await getGithubPRFiles(token, owner, repoName, pr.prNumber);
            const patches = files.slice(0, 10).map(f =>
              `File: ${f.filename}\n${f.patch ? `Diff:\n${f.patch.slice(0, 1000)}` : "(no diff available)"}`
            ).join("\n\n---\n\n");
            codeContext += `\n\nFile Changes:\n${patches}`;
          }
        } catch (err) {
          log.warn({ err }, "Failed to get PR files");
        }
      }
    } else {
      // Repository Code Analysis
      codeContext = `Repository Name: ${repo.fullName}\nDescription: ${repo.description ?? "No description"}\nLanguage: ${repo.language ?? "Unknown"}`;
      if (token) {
        try {
          const [owner, repoName] = repo.fullName.split("/");
          if (owner && repoName) {
            const treeResponse = await getGithubRepoTree(token, owner, repoName);
            const files = treeResponse.tree.filter(f => f.type === "blob");
            
            // Pick a few interesting source code files to build codebase context
            const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".py", ".go", ".java", ".cpp", ".cs"]);
            const sourceFiles = files.filter(f => {
              const extIdx = f.path.lastIndexOf(".");
              if (extIdx === -1) return false;
              const ext = f.path.substring(extIdx).toLowerCase();
              return extensions.has(ext) && !f.path.includes("node_modules") && !f.path.includes("dist");
            });

            const selectedFiles = sourceFiles.slice(0, 5);
            let fileContents = "";
            for (const file of selectedFiles) {
              try {
                const contentRes = await getGithubFileContent(token, owner, repoName, file.path);
                const decoded = Buffer.from(contentRes.content, "base64").toString("utf-8").slice(0, 1200);
                fileContents += `File: ${file.path}\nContent:\n${decoded}\n\n---\n\n`;
              } catch (e) {
                log.warn({ path: file.path, error: e }, "Failed to fetch file content");
              }
            }
            if (fileContents) {
              codeContext += `\n\nCodebase Sample Content:\n${fileContents}`;
            }
          }
        } catch (err) {
          log.warn({ err }, "Failed to get repo codebase content");
        }
      }
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_completion_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are an expert code reviewer. Analyze the codebase files or diffs and provide structured feedback in JSON format.
Return a JSON object with these fields:
- summary: string (2-3 sentence overview)
- risk: string ("Low"|"Medium"|"High")
- complexity: string ("Low"|"Medium"|"High")
- overallScore: number 0-100 (code quality score)
- bugs: array of {severity: "error"|"warning"|"info", message: string, file?: string, line?: number, suggestion?: string}
- securityIssues: array of {severity: "error"|"warning"|"info", message: string, file?: string, line?: number, suggestion?: string}
- performance: array of {severity: "error"|"warning"|"info", message: string, file?: string, line?: number, suggestion?: string}
- refactoring: array of {severity: "error"|"warning"|"info", message: string, file?: string, line?: number, suggestion?: string}
Be specific and actionable.`,
        },
        {
          role: "user",
          content: codeContext,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    const result = JSON.parse(content) as {
      summary?: string;
      risk?: string;
      complexity?: string;
      overallScore?: number;
      bugs?: any[];
      securityIssues?: any[];
      performance?: any[];
      refactoring?: any[];
    };

    const bugs = result.bugs ?? [];
    const securityIssues = result.securityIssues ?? [];
    const performance = result.performance ?? [];
    const refactoring = result.refactoring ?? [];

    const computedRiskScore = pr ? calculateRiskScore(pr, pr.filesChanged, pr.additions, pr.deletions) : (result.risk === "High" ? 85 : result.risk === "Medium" ? 50 : 15);
    const riskLevel = computedRiskScore >= 70 ? "high" : computedRiskScore >= 40 ? "medium" : "low";

    // Generate markdown reviewText
    let md = `## 🔍 Code Review Report\n\n`;
    md += `**Overall Score:** \`${result.overallScore ?? 75}/100\` | **Risk Level:** \`${result.risk ?? "Low"}\` | **Complexity:** \`${result.complexity ?? "Medium"}\`\n\n`;
    md += `### 📝 Summary\n${result.summary ?? "Review completed."}\n\n`;

    const formatMdSection = (title: string, list: any[]) => {
      if (!list || list.length === 0) return "";
      let block = `### ${title}\n`;
      for (const item of list) {
        const fileLoc = item.file ? ` in \`${item.file}\`${item.line ? ` (Line ${item.line})` : ""}` : "";
        block += `- **[${item.severity.toUpperCase()}]**${fileLoc}: ${item.message}\n`;
        if (item.suggestion) {
          block += `  *Suggestion:* \`${item.suggestion}\`\n`;
        }
      }
      return block + "\n";
    };

    md += formatMdSection("🚨 Bugs & Quality Issues", bugs);
    md += formatMdSection("🛡️ Security Warnings", securityIssues);
    md += formatMdSection("⚡ Performance Sugggestions", performance);
    md += formatMdSection("♻️ Refactoring Recommendations", refactoring);

    // Save final completed review in DB
    await db.update(aiReviewsTable).set({
      status: "completed",
      summary: result.summary ?? "Review completed.",
      reviewText: md,
      bugsFound: bugs.length,
      bugs: bugs,
      improvements: [], // deprecated, merged into performance/refactoring
      performance: performance,
      refactoring: refactoring,
      securityIssues: securityIssues,
      complexity: result.complexity ?? "Medium",
      riskScore: computedRiskScore,
      overallScore: result.overallScore ?? 75,
      reviewDuration: Date.now() - startTime,
      tokensUsed: completion.usage?.total_tokens ?? 0,
      updatedAt: new Date(),
    }).where(eq(aiReviewsTable.id, newReview.id));

    if (prId) {
      await db.update(pullRequestsTable).set({
        hasReview: 1,
        reviewStatus: "completed",
        riskScore: computedRiskScore,
        riskLevel,
        updatedAt: new Date(),
      }).where(eq(pullRequestsTable.id, prId));

      // Post Markdown comments to GitHub PR thread
      if (token) {
        try {
          const [owner, repoName] = repo.fullName.split("/");
          if (owner && repoName) {
            await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${pr.prNumber}/comments`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "AI-Powered-Developer-Assistant",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ body: md }),
            });
          }
        } catch (err) {
          log.warn({ err }, "Failed to post GitHub comment");
        }
      }
    }

    // Update repository record stats
    await db.update(repositoriesTable).set({
      lastAnalyzedAt: new Date(),
    }).where(eq(repositoriesTable.id, repoId));

    return newReview;
  } catch (err) {
    log.error({ err }, "AI review failed");
    await db.update(aiReviewsTable).set({ status: "failed", updatedAt: new Date() })
      .where(eq(aiReviewsTable.id, newReview.id));

    if (prId) {
      await db.update(pullRequestsTable).set({ reviewStatus: "pending" })
        .where(eq(pullRequestsTable.id, prId));
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /reviews - List reviews with filtering and pagination
// ---------------------------------------------------------------------------
router.get("/reviews", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = req.query.repoId ? parseInt(req.query.repoId as string) : undefined;
  const risk = req.query.risk as string | undefined;
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string ?? "1");
  const limit = parseInt(req.query.limit as string ?? "20");
  const offset = (page - 1) * limit;

  try {
    let conditions = eq(aiReviewsTable.userId, userId);

    if (repoId) {
      conditions = and(conditions, eq(aiReviewsTable.repositoryId, repoId))!;
    }
    if (risk) {
      if (risk.toLowerCase() === "high") {
        conditions = and(conditions, sql`${aiReviewsTable.riskScore} >= 70`)!;
      } else if (risk.toLowerCase() === "medium") {
        conditions = and(conditions, sql`${aiReviewsTable.riskScore} >= 40 AND ${aiReviewsTable.riskScore} < 70`)!;
      } else if (risk.toLowerCase() === "low") {
        conditions = and(conditions, sql`${aiReviewsTable.riskScore} < 40`)!;
      }
    }
    if (search) {
      conditions = and(conditions, ilike(aiReviewsTable.repositoryName, `%${search}%`))!;
    }

    const reviews = await db.select().from(aiReviewsTable)
      .where(conditions)
      .orderBy(desc(aiReviewsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(reviews);
  } catch (err) {
    logger.error({ err }, "Failed to fetch reviews");
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ---------------------------------------------------------------------------
// GET /reviews/:id - Get detailed review
// ---------------------------------------------------------------------------
router.get("/reviews/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id ?? "0");

  try {
    const reviews = await db.select().from(aiReviewsTable)
      .where(and(eq(aiReviewsTable.id, id), eq(aiReviewsTable.userId, userId)));

    if (reviews.length === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    res.json(reviews[0]);
  } catch (err) {
    logger.error({ err }, "Failed to fetch review detail");
    res.status(500).json({ error: "Failed to fetch review detail" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /reviews/:id - Delete a review
// ---------------------------------------------------------------------------
router.delete("/reviews/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id ?? "0");

  try {
    const deleted = await db.delete(aiReviewsTable)
      .where(and(eq(aiReviewsTable.id, id), eq(aiReviewsTable.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Review not found or unauthorized" });
      return;
    }

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to delete review");
    res.status(500).json({ error: "Failed to delete review" });
  }
});

// ---------------------------------------------------------------------------
// POST /repositories/:repoId/review - Trigger repository review
// ---------------------------------------------------------------------------
router.post("/repositories/:repoId/review", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");

  try {
    const repos = await db.select().from(repositoriesTable)
      .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));

    if (repos.length === 0) {
      res.status(404).json({ error: "Repository not found" });
      return;
    }

    // Delete any previous repository-level reviews for this repo (keep only 1 per repo)
    await db.delete(aiReviewsTable)
      .where(and(
        eq(aiReviewsTable.repositoryId, repoId),
        eq(aiReviewsTable.userId, userId),
        sql`${aiReviewsTable.prId} IS NULL`
      ));

    // Trigger asynchronous review
    runAiReview(undefined, repoId, userId, req.log).catch((err) => {
      logger.error({ err, repoId }, "Background repo review failed");
    });

    res.status(202).json({ repositoryId: repoId, status: "in_progress" });
  } catch (err) {
    logger.error({ err }, "Failed to trigger repository review");
    res.status(500).json({ error: "Failed to trigger repository review" });
  }
});

// ---------------------------------------------------------------------------
// Pull request endpoints
// ---------------------------------------------------------------------------
router.get("/repositories/:repoId/pull-requests/:prId/review", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");
  const prId = parseInt(req.params.prId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));
  if (repos.length === 0) { res.status(404).json({ error: "Repository not found" }); return; }

  const prs = await db.select().from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.id, prId), eq(pullRequestsTable.repoId, repoId)));
  if (prs.length === 0) { res.status(404).json({ error: "PR not found" }); return; }

  const reviews = await db.select().from(aiReviewsTable)
    .where(and(eq(aiReviewsTable.prId, prId), eq(aiReviewsTable.repositoryId, repoId)));

  if (reviews.length === 0) {
    res.json({ id: 0, prId, status: "pending" });
    return;
  }

  const review = reviews[reviews.length - 1]!;
  res.json(review);
});

router.post("/repositories/:repoId/pull-requests/:prId/review", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");
  const prId = parseInt(req.params.prId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));
  if (repos.length === 0) { res.status(404).json({ error: "Repository not found" }); return; }

  const prs = await db.select().from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.id, prId), eq(pullRequestsTable.repoId, repoId)));
  if (prs.length === 0) { res.status(404).json({ error: "PR not found" }); return; }

  // Trigger review asynchronously
  runAiReview(prId, repoId, userId, req.log).catch(() => {});

  res.status(202).json({ prId, status: "in_progress" });
});

router.get("/repositories/:repoId/pull-requests/:prId/risk", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const repoId = parseInt(req.params.repoId ?? "0");
  const prId = parseInt(req.params.prId ?? "0");

  const repos = await db.select().from(repositoriesTable)
    .where(and(eq(repositoriesTable.id, repoId), eq(repositoriesTable.userId, userId)));
  if (repos.length === 0) { res.status(404).json({ error: "Repository not found" }); return; }

  const prs = await db.select().from(pullRequestsTable)
    .where(and(eq(pullRequestsTable.id, prId), eq(pullRequestsTable.repoId, repoId)));
  if (prs.length === 0) { res.status(404).json({ error: "PR not found" }); return; }

  const pr = prs[0]!;
  const riskScore = pr.riskScore ?? calculateRiskScore(pr, pr.filesChanged, pr.additions, pr.deletions);
  const riskLevel = (riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low") as "low" | "medium" | "high";

  res.json({
    prId,
    riskScore: Math.round(riskScore),
    riskLevel,
    factors: [
      { name: "Files Changed", value: pr.filesChanged, weight: 0.3 },
      { name: "Lines Added", value: pr.additions, weight: 0.25 },
      { name: "Lines Removed", value: pr.deletions, weight: 0.2 },
      { name: "Churn Ratio", value: pr.additions > 0 ? Math.round(pr.deletions / pr.additions * 100) : 0, weight: 0.25 },
    ],
    prediction: riskLevel === "high"
      ? "High probability of introducing bugs or breaking changes. Thorough review recommended."
      : riskLevel === "medium"
        ? "Moderate risk. Some areas may require careful review before merging."
        : "Low risk. Changes appear contained and well-scoped.",
  });
});

export default router;
