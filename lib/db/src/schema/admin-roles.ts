import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export type Permissions = Record<string, string[]>;

export const adminRolesTable = pgTable("admin_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  permissions: jsonb("permissions").$type<Permissions>().notNull().default({} as Permissions),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminRole = typeof adminRolesTable.$inferSelect;
