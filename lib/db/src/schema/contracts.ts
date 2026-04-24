import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { transactionsTable } from "./transactions";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().unique().references(() => transactionsTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  pdfUrl: text("pdf_url").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  sellerSignedAt: timestamp("seller_signed_at", { withTimezone: true }),
  buyerSignedAt: timestamp("buyer_signed_at", { withTimezone: true }),
  status: text("status").notNull().default("généré"),
});

export type Contract = typeof contractsTable.$inferSelect;
