import { pgTable, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { repositoriesTable } from "./repositories";

export const pullRequestsTable = pgTable("pull_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  repoId: integer("repo_id").notNull().references(() => repositoriesTable.id),
  prNumber: integer("pr_number").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  state: text("state").notNull().default("open"),
  authorLogin: text("author_login").notNull(),
  authorAvatarUrl: text("author_avatar_url").notNull().default(""),
  filesChanged: integer("files_changed").notNull().default(0),
  additions: integer("additions").notNull().default(0),
  deletions: integer("deletions").notNull().default(0),
  riskScore: real("risk_score"),
  riskLevel: text("risk_level"),
  hasReview: integer("has_review").notNull().default(0),
  reviewStatus: text("review_status").default("pending"),
  mergedAt: timestamp("merged_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPullRequestSchema = createInsertSchema(pullRequestsTable);
export type InsertPullRequest = z.infer<typeof insertPullRequestSchema>;
export type PullRequest = typeof pullRequestsTable.$inferSelect;
