import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const orderStatusEnum = pgEnum("order_status", [
  "en_attente",
  "partiellement_confirmée",
  "confirmée",
  "annulée",
]);

export const orderItemStatusEnum = pgEnum("order_item_status", [
  "en_attente",
  "acceptée",
  "refusée",
  "contre_proposée",
]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  transformateurId: integer("transformateur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  status: orderStatusEnum("status").notNull().default("en_attente"),
  totalFcfa: integer("total_fcfa").notNull(),
  noteGlobale: text("note_globale"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  producteurId: integer("producteur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  quantityKg: integer("quantity_kg").notNull(),
  unitPriceFcfa: integer("unit_price_fcfa").notNull(),
  totalFcfa: integer("total_fcfa").notNull(),
  status: orderItemStatusEnum("status").notNull().default("en_attente"),
  counterQuantityKg: integer("counter_quantity_kg"),
  counterPriceFcfa: integer("counter_price_fcfa"),
  counterNote: text("counter_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
