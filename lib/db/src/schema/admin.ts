import { pgTable, serial, integer, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const adminTargetTypeEnum = pgEnum("admin_target_type", [
  "user",
  "offre",
  "transaction",
  "rating",
  "broadcast",
  "verification",
  "plan",
]);

export const adminLogsTable = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetType: adminTargetTypeEnum("target_type").notNull(),
  targetId: integer("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationAudienceEnum = pgEnum("notification_audience", [
  "all",
  "producteur",
  "transformateur",
  "region",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  audience: notificationAudienceEnum("audience").notNull(),
  audienceValue: text("audience_value"),
  link: text("link"),
  sentBy: integer("sent_by").references(() => usersTable.id, { onDelete: "set null" }),
  reach: integer("reach").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationReadsTable = pgTable("notification_reads", {
  notificationId: integer("notification_id").notNull().references(() => notificationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminLog = typeof adminLogsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
