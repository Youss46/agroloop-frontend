import { pgTable, serial, integer, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const devisStatusEnum = pgEnum("devis_status", [
  "en_attente",
  "accepté",
  "refusé",
  "contre_proposé",
  "contre_proposé_accepté",
  "contre_proposé_refusé",
  "expiré",
]);

export const devisTable = pgTable("devis", {
  id: serial("id").primaryKey(),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  transformateurId: integer("transformateur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  producteurId: integer("producteur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  status: devisStatusEnum("status").notNull().default("en_attente"),

  // Transformateur initial offer
  quantityKg: integer("quantity_kg").notNull(),
  priceFcfa: integer("price_fcfa").notNull(),
  totalFcfa: integer("total_fcfa").notNull(),
  note: text("note"),

  // Producteur response
  responseNote: text("response_note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),

  // Counter-proposal (producteur)
  counterQuantityKg: integer("counter_quantity_kg"),
  counterPriceFcfa: integer("counter_price_fcfa"),
  counterTotalFcfa: integer("counter_total_fcfa"),
  counterNote: text("counter_note"),

  // Counter-proposal response (transformateur)
  counterResponseNote: text("counter_response_note"),
  counterRespondedAt: timestamp("counter_responded_at", { withTimezone: true }),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // At most one active devis per (offre, transformateur) pair
  uniqueActiveDevisPerOffre: uniqueIndex("devis_unique_active_per_offre")
    .on(t.offreId, t.transformateurId)
    .where(sql`status IN ('en_attente', 'contre_proposé')`),
}));

export const insertDevisSchema = createInsertSchema(devisTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertDevis = z.infer<typeof insertDevisSchema>;
export type Devis = typeof devisTable.$inferSelect;
