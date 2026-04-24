import { pgTable, serial, integer, text, timestamp, pgEnum, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const userNotificationTypeEnum = pgEnum("user_notification_type", [
  "nouveau_message",
  "offre_correspondante",
  "transaction_confirmee",
  "transaction_annulee",
  "nouvel_avis",
  "offre_expiree",
  "broadcast",
]);

export const userNotificationsTable = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: userNotificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferencesTable = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  filieresSouhaitees: text("filieres_souhaitees").array().notNull().default(sql`ARRAY[]::text[]`),
  residusSouhaites: text("residus_souhaites").array().notNull().default(sql`ARRAY[]::text[]`),
  regionsSouhaitees: text("regions_souhaitees").array().notNull().default(sql`ARRAY[]::text[]`),
  prixMaxFcfa: integer("prix_max_fcfa"),
  notifNouveauMessage: boolean("notif_nouveau_message").notNull().default(true),
  notifOffreMatch: boolean("notif_offre_match").notNull().default(true),
  notifTransaction: boolean("notif_transaction").notNull().default(true),
  notifAvis: boolean("notif_avis").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userUnique: uniqueIndex("user_preferences_user_id_unique").on(t.userId),
}));

export type UserNotification = typeof userNotificationsTable.$inferSelect;
export type UserPreferences = typeof userPreferencesTable.$inferSelect;
