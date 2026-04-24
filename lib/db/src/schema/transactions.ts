import { pgTable, serial, timestamp, pgEnum, integer, AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { residusTable } from "./residus";
import { devisTable } from "./devis";
import { ordersTable, orderItemsTable } from "./orders";

export const transactionStatusEnum = pgEnum("transaction_status", ["en_attente", "confirmée", "annulée"]);
export const transactionSourceEnum = pgEnum("transaction_source", ["devis", "commande", "directe"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  residuId: integer("residu_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  quantityKg: integer("quantity_kg").notNull(),
  totalFcfa: integer("total_fcfa").notNull(),
  status: transactionStatusEnum("status").notNull().default("en_attente"),
  source: transactionSourceEnum("source").notNull().default("directe"),
  devisId: integer("devis_id").references((): AnyPgColumn => devisTable.id, { onDelete: "set null" }),
  orderId: integer("order_id").references((): AnyPgColumn => ordersTable.id, { onDelete: "set null" }),
  orderItemId: integer("order_item_id").references((): AnyPgColumn => orderItemsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
