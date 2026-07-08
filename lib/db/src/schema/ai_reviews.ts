import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pullRequestsTable } from "./pull_requests";
import { repositoriesTable } from "./repositories";
import { usersTable } from "./users";

export const aiReviewsTable = pgTable("ai_reviews", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  prId: integer("pr_id").references(() => pullRequestsTable.id),
  repositoryId: integer("repository_id").references(() => repositoriesTable.id),
  repositoryName: text("repository_name"),
  pullRequestNumber: integer("pull_request_number"),
  branch: text("branch"),
  fileName: text("file_name"),
  userId: integer("user_id").references(() => usersTable.id),
  status: text("status").notNull().default("pending"),
  summary: text("summary"),
  reviewText: text("review_text"),
  bugsFound: integer("bugs_found").notNull().default(0),
  bugs: jsonb("bugs").$type<Array<{ severity: string; message: string; file?: string; line?: number; suggestion?: string }>>(),
  improvements: jsonb("improvements").$type<Array<{ severity: string; message: string; file?: string; line?: number; suggestion?: string }>>(),
  performance: jsonb("performance").$type<Array<{ severity: string; message: string; file?: string; line?: number; suggestion?: string }>>(),
  refactoring: jsonb("refactoring").$type<Array<{ severity: string; message: string; file?: string; line?: number; suggestion?: string }>>(),
  securityIssues: jsonb("security_issues").$type<Array<{ severity: string; message: string; file?: string; line?: number; suggestion?: string }>>(),
  complexity: text("complexity"),
  riskScore: integer("risk_score").notNull().default(0),
  reviewDuration: integer("review_duration").notNull().default(0),
  tokensUsed: integer("tokens_used").notNull().default(0),
  overallScore: integer("overall_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiReviewSchema = createInsertSchema(aiReviewsTable);
export type InsertAiReview = z.infer<typeof insertAiReviewSchema>;
export type AiReview = typeof aiReviewsTable.$inferSelect;
