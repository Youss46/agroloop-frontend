import { pgTable, serial, integer, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { transactionsTable } from "./transactions";

export const ratingsTable = pgTable("ratings", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactionsTable.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  revieweeId: integer("reviewee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  stars: integer("stars").notNull(),
  comment: text("comment"),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueReviewer: uniqueIndex("rating_tx_reviewer_unique").on(table.transactionId, table.reviewerId),
}));

export type Rating = typeof ratingsTable.$inferSelect;
