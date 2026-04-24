import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const cartItemsTable = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  quantityKg: integer("quantity_kg").notNull(),
  note: text("note"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueUserOffre: uniqueIndex("cart_items_user_offre_unique").on(t.userId, t.offreId),
}));

export type CartItem = typeof cartItemsTable.$inferSelect;
