import { pgTable, text, serial, timestamp, pgEnum, integer, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", [
  "producteur",
  "transformateur",
  "admin",
  "super_admin",
  "moderateur",
  "support",
  "finance",
  "commercial",
]);

export const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "moderateur",
  "support",
  "finance",
  "commercial",
] as const;

export type AdminRoleName = typeof ADMIN_ROLES[number];

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  phone: text("phone"),
  region: text("region"),
  ratingAvg: numeric("rating_avg", { precision: 2, scale: 1 }).notNull().default("0.0"),
  ratingCount: integer("rating_count").notNull().default(0),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  filieres: text("filieres").array().notNull().default(sql`ARRAY[]::text[]`),
  verificationStatus: text("verification_status").notNull().default("non_verifie"),
  verificationLevel: integer("verification_level").notNull().default(0),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  adminRoleId: integer("admin_role_id"),
  createdByAdminId: integer("created_by_admin_id"),
  isAdminActive: boolean("is_admin_active").notNull().default(true),
  forcePasswordChange: boolean("force_password_change").notNull().default(false),
  tokenVersion: integer("token_version").notNull().default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  showOnlineStatus: boolean("show_online_status").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailLowerUnique: uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
