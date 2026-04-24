import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, subscriptionInvoicesTable, subscriptionsTable, plansTable, usersTable } from "@workspace/db";

const GREEN = "#16a34a";
const DARK = "#0f172a";
const MUTED = "#475569";
const ORANGE = "#ea580c";

const INVOICES_DIR = path.resolve(process.cwd(), "invoices");
if (!fs.existsSync(INVOICES_DIR)) fs.mkdirSync(INVOICES_DIR, { recursive: true });

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
const dateFR = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const monthShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { month: "short", year: "numeric" });

// ===== Issuer info — overridable via env for fiscal compliance (Côte d'Ivoire) =====
const ISSUER = {
  name: process.env.INVOICE_ISSUER_NAME || "AgroLoopCI SARL",
  rccm: process.env.INVOICE_ISSUER_RCCM || "RCCM CI-ABJ-XXXX-XXXX",
  ncc: process.env.INVOICE_ISSUER_NCC || "NCC XXXXXXXX",
  address: process.env.INVOICE_ISSUER_ADDRESS || "Cocody, Abidjan, Côte d'Ivoire",
  phone: process.env.INVOICE_ISSUER_PHONE || "+225 27 00 00 00 00",
  email: process.env.INVOICE_ISSUER_EMAIL || "facturation@agroloopci.ci",
};
// TVA rate as percentage (e.g. "0", "18"). Default 0 → "TVA non applicable" mention.
// Clamp to a safe fiscal range so a malformed env var can't produce nonsensical totals.
const TVA_RATE_RAW = Number(process.env.INVOICE_TVA_RATE ?? "0");
const TVA_RATE = Number.isFinite(TVA_RATE_RAW) ? Math.min(100, Math.max(0, TVA_RATE_RAW)) : 0;

export async function generateInvoicePdf(invoiceId: number): Promise<string> {
  const [inv] = await db.select().from(subscriptionInvoicesTable).where(eq(subscriptionInvoicesTable.id, invoiceId));
  if (!inv) throw new Error("Facture introuvable");
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, inv.subscriptionId));
  if (!sub) throw new Error("Abonnement introuvable");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId));
  if (!user) throw new Error("Utilisateur introuvable");
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, sub.planId));

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ===== HEADER — issuer block (left) =====
  doc.fillColor(GREEN).fontSize(20).font("Helvetica-Bold").text(ISSUER.name, 40, 40);
  doc.fontSize(8).font("Helvetica").fillColor(MUTED).text("Économie circulaire agricole", 40, 62);
  doc.fontSize(8).fillColor(DARK).font("Helvetica");
  doc.text(ISSUER.address, 40, 76);
  doc.text(`Tél : ${ISSUER.phone}  ·  ${ISSUER.email}`, 40, 88);
  doc.text(`${ISSUER.rccm}  ·  ${ISSUER.ncc}`, 40, 100);

  // FACTURE title (center)
  doc.fillColor(DARK).fontSize(18).font("Helvetica-Bold").text("FACTURE", 0, 45, { align: "center" });

  // Reference box top-right
  const boxX = 400, boxY = 40, boxW = 155;
  doc.roundedRect(boxX, boxY, boxW, 60, 4).strokeColor(GREEN).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(MUTED).font("Helvetica").text("N° de facture", boxX + 8, boxY + 6);
  doc.fontSize(10).fillColor(DARK).font("Helvetica-Bold").text(inv.reference, boxX + 8, boxY + 18);
  doc.fontSize(8).fillColor(MUTED).font("Helvetica").text(`Émise le : ${dateFR(inv.createdAt)}`, boxX + 8, boxY + 32);
  const dueDate = inv.paidAt ?? inv.createdAt;
  doc.text(`Échéance : ${dateFR(dueDate)}`, boxX + 8, boxY + 44);
  const isPaid = inv.status === "payée";
  doc.fillColor(isPaid ? GREEN : ORANGE).font("Helvetica-Bold")
    .text(isPaid ? "PAYÉE" : inv.status === "annulée" ? "ANNULÉE" : "EN ATTENTE", boxX + 90, boxY + 44);

  doc.moveTo(40, 120).lineTo(555, 120).strokeColor(GREEN).lineWidth(1.5).stroke();

  // ===== BILL TO =====
  let y = 135;
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("FACTURÉ À", 40, y);
  y += 18;
  doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(user.name, 40, y);
  y += 14;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica");
  if (user.email) { doc.text(`Email : ${user.email}`, 40, y); y += 12; }
  if (user.phone) { doc.text(`Téléphone : ${user.phone}`, 40, y); y += 12; }
  if ((user as any).region) { doc.text(`Région : ${(user as any).region}`, 40, y); y += 12; }
  y += 16;

  // ===== LINE ITEMS TABLE =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("DÉTAILS", 40, y);
  y += 16;
  // Header row
  doc.rect(40, y, 515, 22).fillAndStroke("#f0fdf4", GREEN);
  doc.fillColor(GREEN).fontSize(9).font("Helvetica-Bold")
    .text("Description", 48, y + 7, { width: 240 })
    .text("Période", 290, y + 7, { width: 130 })
    .text("Montant HT", 425, y + 7, { width: 122, align: "right" });
  y += 22;
  // Item row
  doc.rect(40, y, 515, 26).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  const planLabel = plan ? `Abonnement ${plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}` : inv.planName;
  doc.fillColor(DARK).fontSize(10).font("Helvetica").text(planLabel, 48, y + 8, { width: 240 });
  doc.text(`${monthShort(inv.periodStart)} – ${monthShort(inv.periodEnd)}`, 290, y + 8, { width: 130 });
  // For TVA breakdown, the invoice price is treated as TTC (inclusive). Compute HT from TTC when TVA > 0.
  const amountTTC = inv.amountFcfa;
  const amountHT = TVA_RATE > 0 ? Math.round(amountTTC / (1 + TVA_RATE / 100)) : amountTTC;
  const amountTVA = amountTTC - amountHT;
  doc.font("Helvetica-Bold").text(FCFA(amountHT), 425, y + 8, { width: 122, align: "right" });
  y += 32;

  // ===== TOTALS BLOCK (HT / TVA / TTC) =====
  // Right-aligned summary lines.
  const sumX = 320, sumW = 235;
  doc.fillColor(MUTED).fontSize(9).font("Helvetica");
  doc.text("Total HT", sumX, y, { width: 130 });
  doc.fillColor(DARK).font("Helvetica-Bold").text(FCFA(amountHT), sumX + 113, y, { width: 122, align: "right" });
  y += 14;
  doc.fillColor(MUTED).font("Helvetica");
  if (TVA_RATE > 0) {
    doc.text(`TVA (${TVA_RATE} %)`, sumX, y, { width: 130 });
    doc.fillColor(DARK).font("Helvetica-Bold").text(FCFA(amountTVA), sumX + 113, y, { width: 122, align: "right" });
  } else {
    doc.text("TVA", sumX, y, { width: 130 });
    doc.fillColor(DARK).font("Helvetica").text("Non applicable", sumX + 113, y, { width: 122, align: "right" });
  }
  y += 18;
  doc.rect(sumX - 8, y, sumW + 8, 28).fillAndStroke("#f0fdf4", GREEN);
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("TOTAL TTC", sumX, y + 9, { width: 130 });
  doc.fontSize(13).text(FCFA(amountTTC), sumX + 113, y + 8, { width: 122, align: "right" });
  y += 42;

  // ===== PAYMENT INFO =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("PAIEMENT", 40, y);
  y += 16;
  const methodLabel: Record<string, string> = {
    orange_money: "Orange Money",
    wave: "Wave",
    mtn_money: "MTN Money",
    virement: "Virement bancaire",
    gratuit: "Gratuit",
  };
  doc.fillColor(DARK).fontSize(10).font("Helvetica");
  doc.text(`Méthode : ${methodLabel[inv.paymentMethod ?? ""] ?? inv.paymentMethod ?? "—"}`, 40, y); y += 14;
  if (sub.paymentReference) { doc.text(`Référence transaction : ${sub.paymentReference}`, 40, y); y += 14; }
  if (inv.paidAt) { doc.fillColor(GREEN).text(`Payée le : ${dateFR(inv.paidAt)}`, 40, y); y += 14; }
  y += 8;

  // ===== LEGAL MENTIONS (Côte d'Ivoire) =====
  doc.fillColor(MUTED).fontSize(8).font("Helvetica-Oblique");
  if (TVA_RATE === 0) {
    doc.text(
      "TVA non applicable — entreprise non assujettie à la TVA. Facture conforme aux exigences du Code Général des Impôts de Côte d'Ivoire.",
      40, y, { width: 515 },
    );
    y += 22;
  }
  doc.fillColor(MUTED).fontSize(7).font("Helvetica");
  doc.text(
    "En cas de retard de paiement, des pénalités de 1,5 % par mois pourront être appliquées (taux légal en vigueur en Côte d'Ivoire). " +
    "Aucun escompte n'est accordé pour règlement anticipé. Tout litige relève de la compétence des tribunaux d'Abidjan.",
    40, y, { width: 515 },
  );

  // ===== FOOTER =====
  const footerY = 770;
  doc.moveTo(40, footerY - 6).lineTo(555, footerY - 6).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
  doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold")
    .text(`${ISSUER.name} · ${ISSUER.rccm} · ${ISSUER.ncc}`, 40, footerY, { width: 515, align: "center" });
  doc.font("Helvetica").fontSize(7)
    .text(`${ISSUER.address} · ${ISSUER.phone} · ${ISSUER.email}`, 40, footerY + 11, { width: 515, align: "center" })
    .text(`Document généré automatiquement le ${new Date().toLocaleString("fr-FR")}`, 40, footerY + 22, { width: 515, align: "center" });

  doc.end();
  const buf = await done;
  const filePath = path.join(INVOICES_DIR, `${inv.reference}.pdf`);
  await fs.promises.writeFile(filePath, buf);
  await db.update(subscriptionInvoicesTable).set({ pdfUrl: filePath }).where(eq(subscriptionInvoicesTable.id, inv.id));
  return filePath;
}

export { INVOICES_DIR };
