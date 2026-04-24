import crypto from "node:crypto";
import { db, devisTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateDevisReference(date = new Date()): string {
  const year = date.getFullYear();
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length];
  return `DEV-AGRL-${year}-${suffix}`;
}

export async function generateUniqueDevisReference(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const ref = generateDevisReference();
    const [coll] = await db.select({ id: devisTable.id }).from(devisTable).where(eq(devisTable.reference, ref));
    if (!coll) return ref;
  }
  // Extremely unlikely fallback
  return generateDevisReference() + "-" + Date.now().toString(36).toUpperCase();
}

export const DEVIS_EXPIRY_MS = 48 * 60 * 60 * 1000;
