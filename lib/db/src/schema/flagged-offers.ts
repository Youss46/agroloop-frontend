import { pgTable, serial, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const flaggedOfferStatusEnum = pgEnum("flagged_offer_status", [
  "en_attente",
  "traité",
]);

export const flaggedOffersTable = pgTable("flagged_offers", {
  id: serial("id").primaryKey(),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  reportedBy: integer("reported_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  comment: text("comment"),
  status: flaggedOfferStatusEnum("status").notNull().default("en_attente"),
  adminDecision: text("admin_decision"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byOffre: index("flagged_offers_offre_idx").on(t.offreId),
  byStatus: index("flagged_offers_status_idx").on(t.status),
}));

export type FlaggedOffer = typeof flaggedOffersTable.$inferSelect;
