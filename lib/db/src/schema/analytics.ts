import { pgTable, serial, text, integer, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const deviceTypeEnum = pgEnum("device_type", ["mobile", "tablet", "desktop"]);

export const conversionEventTypeEnum = pgEnum("conversion_event_type", [
  "visit",
  "register",
  "first_offer",
  "first_contact",
  "first_transaction",
  "subscription",
]);

export const pageViewsTable = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  referrer: text("referrer"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  deviceType: deviceTypeEnum("device_type").notNull().default("desktop"),
  region: text("region"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const offerViewsTable = pgTable("offer_views", {
  id: serial("id").primaryKey(),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").references(() => usersTable.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversionEventsTable = pgTable("conversion_events", {
  id: serial("id").primaryKey(),
  eventType: conversionEventTypeEnum("event_type").notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PageView = typeof pageViewsTable.$inferSelect;
export type OfferView = typeof offerViewsTable.$inferSelect;
export type ConversionEvent = typeof conversionEventsTable.$inferSelect;
