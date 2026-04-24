import { pgTable, text, serial, timestamp, pgEnum, integer, doublePrecision, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const residuStatusEnum = pgEnum("residu_status", ["disponible", "vendu", "expiré"]);
export const disponibiliteEnum = pgEnum("disponibilite", ["immediate", "planifiee"]);

export const residusTable = pgTable("residus", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  typeResidu: text("type_residu").notNull(),
  quantityKg: integer("quantity_kg").notNull(),
  priceFcfa: integer("price_fcfa").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  region: text("region").notNull(),
  description: text("description"),
  status: residuStatusEnum("status").notNull().default("disponible"),
  disponibilite: disponibiliteEnum("disponibilite").notNull().default("immediate"),
  dateDisponibilite: date("date_disponibilite"),
  livraisonPossible: boolean("livraison_possible").notNull().default(false),
  shareCount: integer("share_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResiduSchema = createInsertSchema(residusTable).omit({ id: true, createdAt: true });
export type InsertResidu = z.infer<typeof insertResiduSchema>;
export type Residu = typeof residusTable.$inferSelect;
