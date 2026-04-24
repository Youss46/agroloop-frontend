import { pgTable, serial, integer, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const favoriteTypeEnum = pgEnum("favorite_type", ["offre", "producteur"]);

export const favoritesTable = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: favoriteTypeEnum("type").notNull(),
  offreId: integer("offre_id").references(() => residusTable.id, { onDelete: "cascade" }),
  producteurId: integer("producteur_id").references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byUser: index("favorites_user_idx").on(t.userId),
  uniqOffre: uniqueIndex("favorites_user_offre_uniq").on(t.userId, t.offreId),
  uniqProd: uniqueIndex("favorites_user_producteur_uniq").on(t.userId, t.producteurId),
}));

export type Favorite = typeof favoritesTable.$inferSelect;
