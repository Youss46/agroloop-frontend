import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { residusTable } from "./residus";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  producteurId: integer("producteur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  transformateurId: integer("transformateur_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  offerBuyerUnique: uniqueIndex("conv_offer_buyer_unique").on(table.offerId, table.transformateurId),
}));

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
