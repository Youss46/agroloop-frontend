import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { residusTable } from "./residus";

export const offerPhotosTable = pgTable("offer_photos", {
  id: serial("id").primaryKey(),
  offreId: integer("offre_id").notNull().references(() => residusTable.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  fileName: text("file_name"),
  isCover: boolean("is_cover").notNull().default(false),
  position: integer("position").notNull().default(0),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OfferPhoto = typeof offerPhotosTable.$inferSelect;
