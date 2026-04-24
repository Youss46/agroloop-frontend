import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const paymentSettingsTable = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  method: text("method").notNull().unique(),
  label: text("label").notNull(),
  accountName: text("account_name").notNull(),
  number: text("number").notNull(),
  instructions: text("instructions"),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export type PaymentSetting = typeof paymentSettingsTable.$inferSelect;
