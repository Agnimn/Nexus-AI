import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { repositoriesTable } from "./repositories";

export const activityItemsTable = pgTable("activity_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  repoId: integer("repo_id").references(() => repositoriesTable.id),
  type: text("type").notNull(),
  repoName: text("repo_name").notNull(),
  actorLogin: text("actor_login").notNull(),
  actorAvatarUrl: text("actor_avatar_url").notNull().default(""),
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityItemSchema = createInsertSchema(activityItemsTable);
export type InsertActivityItem = z.infer<typeof insertActivityItemSchema>;
export type ActivityItem = typeof activityItemsTable.$inferSelect;
