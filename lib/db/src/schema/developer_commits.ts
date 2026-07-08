import { pgTable, text, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { repositoriesTable } from "./repositories";

export const developerCommitsTable = pgTable("developer_commits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  repoId: integer("repo_id").notNull().references(() => repositoriesTable.id),
  authorLogin: text("author_login").notNull(),
  authorAvatarUrl: text("author_avatar_url").notNull().default(""),
  sha: text("sha").notNull(),
  message: text("message").notNull(),
  additions: integer("additions").notNull().default(0),
  deletions: integer("deletions").notNull().default(0),
  filesChanged: integer("files_changed").notNull().default(0),
  riskScore: real("risk_score"),
  committedAt: timestamp("committed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeveloperCommitSchema = createInsertSchema(developerCommitsTable);
export type InsertDeveloperCommit = z.infer<typeof insertDeveloperCommitSchema>;
export type DeveloperCommit = typeof developerCommitsTable.$inferSelect;
