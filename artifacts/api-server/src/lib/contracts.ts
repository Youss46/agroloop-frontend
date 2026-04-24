import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, contractsTable, transactionsTable, residusTable, usersTable } from "@workspace/db";

const COMMISSION_RATE = 0.04;
const GREEN = "#16a34a";
const DARK = "#0f172a";
const MUTED = "#475569";

const CONTRACTS_DIR = path.resolve(process.cwd(), "contracts");
if (!fs.existsSync(CONTRACTS_DIR)) fs.mkdirSync(CONTRACTS_DIR, { recursive: true });

export function generateReference(date = new Date()): string {
  const year = date.getFullYear();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) suffix += alphabet[bytes[i] % alphabet.length];
  return `AGRL-${year}-${suffix}`;
}

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
const KG = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " kg";
const dateFR = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

interface PdfInputs {
  reference: string;
  generatedAt: Date;
  transaction: { id: number; quantityKg: number; totalFcfa: number; status: string };
  offer: { typeResidu: string; region: string; description: string | null; priceFcfa: number; quantityKg: number; disponibilite: string };
  seller: { name: string; phone: string | null; email: string | null; region: string | null; verificationLevel: number };
  buyer: { name: string; phone: string | null; email: string | null; region: string | null; verificationLevel: number };
  sellerSignedAt: Date | null;
  buyerSignedAt: Date | null;
  publicBaseUrl: string;
}

async function buildPdfBuffer(input: PdfInputs): Promise<Buffer> {
  const verifyUrl = `${input.publicBaseUrl.replace(/\/$/, "")}/verifier/${input.reference}`;
  const qrPayload = JSON.stringify({
    reference: input.reference,
    transaction_id: input.transaction.id,
    generated_at: input.generatedAt.toISOString(),
    verify_url: verifyUrl,
  });
  const qrPng = await QRCode.toBuffer(qrPayload, { width: 120, margin: 0 });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ===== HEADER =====
  doc
    .fillColor(GREEN).fontSize(22).font("Helvetica-Bold")
    .text("AgroLoopCI", 40, 40)
    .fontSize(8).font("Helvetica").fillColor(MUTED)
    .text("Économie circulaire agricole", 40, 65);

  doc.fillColor(DARK).fontSize(20).font("Helvetica-Bold")
    .text("BON DE COMMANDE", 0, 45, { align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
    .text("Plateforme de valorisation des résidus agricoles", 0, 70, { align: "center" });

  // Reference box top-right
  const boxX = 400, boxY = 40, boxW = 155;
  doc.roundedRect(boxX, boxY, boxW, 55, 4).strokeColor(GREEN).lineWidth(1).stroke();
  doc.fontSize(8).fillColor(MUTED).font("Helvetica")
    .text("Référence :", boxX + 8, boxY + 6);
  doc.fontSize(10).fillColor(DARK).font("Helvetica-Bold")
    .text(input.reference, boxX + 8, boxY + 18);
  doc.fontSize(8).fillColor(MUTED).font("Helvetica")
    .text(`Date : ${dateFR(input.generatedAt)}`, boxX + 8, boxY + 32);
  doc.fillColor(GREEN).font("Helvetica-Bold")
    .text(`Statut : ${input.transaction.status}`, boxX + 8, boxY + 43);

  // Divider
  doc.moveTo(40, 110).lineTo(555, 110).strokeColor(GREEN).lineWidth(1.5).stroke();

  // ===== SECTION 1: PARTIES =====
  let y = 125;
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("PARTIES CONCERNÉES", 40, y);
  y += 18;

  const colW = 250;
  const drawParty = (label: string, x: number, p: PdfInputs["seller"], role: string) => {
    doc.fillColor(GREEN).fontSize(9).font("Helvetica-Bold").text(label, x, y);
    let ly = y + 14;
    const line = (k: string, v: string | null) => {
      doc.fillColor(MUTED).fontSize(8).font("Helvetica").text(k, x, ly);
      doc.fillColor(DARK).fontSize(9).font("Helvetica").text(v || "—", x + 70, ly, { width: colW - 70 });
      ly += 12;
    };
    line("Nom :", p.name);
    line("Rôle :", role);
    line("Région :", p.region);
    line("Téléphone :", p.phone);
    line("Email :", p.email);
    line("Statut :", p.verificationLevel >= 2 ? "✓ Vérifié" : p.verificationLevel === 1 ? "Email vérifié" : "Non vérifié");
    return ly;
  };
  const ySellerEnd = drawParty("VENDEUR", 40, input.seller, "Producteur");
  const yBuyerEnd = drawParty("ACHETEUR", 305, input.buyer, "Transformateur");
  y = Math.max(ySellerEnd, yBuyerEnd) + 12;

  // ===== SECTION 2: PRODUIT =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("DÉTAILS DU PRODUIT", 40, y);
  y += 16;
  const tableRows: [string, string][] = [
    ["Type de résidu", input.offer.typeResidu],
    ["Quantité", KG(input.transaction.quantityKg)],
    ["Prix unitaire", FCFA(input.offer.priceFcfa / input.offer.quantityKg) + " / kg"],
    ["Disponibilité", input.offer.disponibilite === "immediate" ? "Immédiate" : "Planifiée"],
    ["Région de collecte", input.offer.region],
  ];
  if (input.offer.description) tableRows.push(["Description", input.offer.description.slice(0, 200)]);
  for (const [k, v] of tableRows) {
    doc.rect(40, y, 515, 18).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(k, 48, y + 5, { width: 170 });
    doc.fillColor(DARK).font("Helvetica-Bold").text(v, 220, y + 5, { width: 327 });
    y += 18;
  }
  y += 12;

  // ===== SECTION 3: FINANCIER =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("RÉCAPITULATIF FINANCIER", 40, y);
  y += 16;
  const subtotal = input.transaction.totalFcfa;
  const commission = Math.round(subtotal * COMMISSION_RATE);
  const total = subtotal + commission;
  const finRows: [string, string, boolean][] = [
    ["Sous-total", FCFA(subtotal), false],
    [`Commission plateforme (${(COMMISSION_RATE * 100).toFixed(0)}%)`, FCFA(commission), false],
    ["TOTAL À RÉGLER", FCFA(total), true],
  ];
  for (const [k, v, hi] of finRows) {
    if (hi) doc.rect(40, y, 515, 22).fillAndStroke("#f0fdf4", GREEN);
    else doc.rect(40, y, 515, 18).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    const h = hi ? 22 : 18;
    doc.fillColor(hi ? GREEN : DARK).fontSize(hi ? 11 : 9).font(hi ? "Helvetica-Bold" : "Helvetica")
      .text(k, 48, y + (hi ? 6 : 5), { width: 300 });
    doc.fillColor(hi ? GREEN : DARK).fontSize(hi ? 12 : 9).font("Helvetica-Bold")
      .text(v, 380, y + (hi ? 6 : 5), { width: 167, align: "right" });
    y += h;
  }
  y += 14;

  // ===== SECTION 4: CONDITIONS =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("CONDITIONS GÉNÉRALES", 40, y);
  y += 14;
  const conditions = [
    "Le vendeur s'engage à livrer la quantité et qualité de résidus tels que décrits dans la présente commande.",
    "L'acheteur s'engage à régler le montant total à la livraison ou selon les modalités convenues entre les parties.",
    "Tout litige relatif à cette transaction devra être signalé sur la plateforme AgroLoopCI dans les 48h suivant la livraison.",
    "AgroLoopCI intervient en qualité d'intermédiaire et ne saurait être tenue responsable des litiges entre parties.",
    "Ce document tient lieu de bon de commande officiel et peut être utilisé à des fins comptables.",
  ];
  doc.fillColor(DARK).fontSize(8).font("Helvetica");
  for (let i = 0; i < conditions.length; i++) {
    doc.text(`${i + 1}. ${conditions[i]}`, 48, y, { width: 507 });
    y = doc.y + 3;
  }
  y += 8;

  // ===== SECTION 5: SIGNATURES =====
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("SIGNATURES", 40, y);
  y += 14;
  const drawSig = (x: number, label: string, who: string, signedAt: Date | null) => {
    doc.rect(x, y, 250, 80).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
    doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold").text(label, x + 8, y + 8);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Nom : ${who}`, x + 8, y + 22);
    if (signedAt) {
      doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold").text("✓ Signé électroniquement", x + 8, y + 38);
      doc.fillColor(MUTED).fontSize(7).font("Helvetica").text(`Le ${signedAt.toLocaleString("fr-FR")}`, x + 8, y + 54);
    } else {
      doc.fillColor(MUTED).fontSize(7).font("Helvetica").text("Date :  _________________", x + 8, y + 42);
      doc.text("Signature :  ____________________", x + 8, y + 58);
    }
  };
  drawSig(40, "Lu et approuvé — Vendeur", input.seller.name, input.sellerSignedAt);
  drawSig(305, "Lu et approuvé — Acheteur", input.buyer.name, input.buyerSignedAt);
  y += 92;

  // ===== FOOTER =====
  const footerY = 760;
  doc.image(qrPng, 40, footerY - 20, { width: 50, height: 50 });
  doc.fillColor(MUTED).fontSize(7).font("Helvetica").text("Scanner pour vérifier", 40, footerY + 32, { width: 60 });

  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
    .text("AgroLoopCI · Économie circulaire · Côte d'Ivoire", 100, footerY, { width: 360, align: "center" });
  doc.text(`Page 1/1 · Réf : ${input.reference}`, 100, footerY + 12, { width: 360, align: "center" });
  doc.fontSize(7).fillColor(MUTED)
    .text(`Document généré automatiquement le ${input.generatedAt.toLocaleString("fr-FR")}`, 100, footerY + 26, { width: 360, align: "center" });

  doc.end();
  return done;
}

interface GenerateInput {
  transactionId: number;
  publicBaseUrl?: string;
}

export async function generateContractForTransaction(input: GenerateInput) {
  const publicBaseUrl = input.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "https://agroloopci.ci";

  // Fetch transaction joined with residu, seller, buyer
  const [row] = await db
    .select({
      tx: transactionsTable,
      offer: residusTable,
    })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(transactionsTable.id, input.transactionId));
  if (!row || !row.offer) throw new Error("Transaction introuvable");

  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, row.tx.sellerId));
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, row.tx.buyerId));
  if (!seller || !buyer) throw new Error("Vendeur ou acheteur introuvable");

  // Idempotent: if a contract already exists, return it
  const [existing] = await db.select().from(contractsTable).where(eq(contractsTable.transactionId, input.transactionId));
  if (existing) return existing;

  let reference = generateReference();
  // Avoid the (extremely unlikely) collision
  for (let i = 0; i < 5; i++) {
    const [coll] = await db.select().from(contractsTable).where(eq(contractsTable.reference, reference));
    if (!coll) break;
    reference = generateReference();
  }

  const generatedAt = new Date();
  const buf = await buildPdfBuffer({
    reference,
    generatedAt,
    transaction: { id: row.tx.id, quantityKg: row.tx.quantityKg, totalFcfa: row.tx.totalFcfa, status: row.tx.status },
    offer: {
      typeResidu: row.offer.typeResidu,
      region: row.offer.region,
      description: row.offer.description,
      priceFcfa: row.offer.priceFcfa,
      quantityKg: row.offer.quantityKg,
      disponibilite: row.offer.disponibilite,
    },
    seller: { name: seller.name, phone: seller.phone, email: seller.email, region: (seller as any).region ?? null, verificationLevel: (seller as any).verificationLevel ?? 0 },
    buyer:  { name: buyer.name,  phone: buyer.phone,  email: buyer.email,  region: (buyer as any).region ?? null,  verificationLevel: (buyer as any).verificationLevel ?? 0 },
    sellerSignedAt: null,
    buyerSignedAt: null,
    publicBaseUrl,
  });

  const filePath = path.join(CONTRACTS_DIR, `${reference}.pdf`);
  await fs.promises.writeFile(filePath, buf);

  const [inserted] = await db.insert(contractsTable).values({
    transactionId: input.transactionId,
    reference,
    pdfUrl: filePath,
    status: "généré",
  }).returning();

  return inserted;
}

export async function regeneratePdfWithSignatures(contractId: number, publicBaseUrl?: string) {
  const [c] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!c) throw new Error("Contrat introuvable");
  const [row] = await db
    .select({ tx: transactionsTable, offer: residusTable })
    .from(transactionsTable)
    .leftJoin(residusTable, eq(transactionsTable.residuId, residusTable.id))
    .where(eq(transactionsTable.id, c.transactionId));
  if (!row || !row.offer) throw new Error("Transaction introuvable");
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, row.tx.sellerId));
  const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, row.tx.buyerId));

  const buf = await buildPdfBuffer({
    reference: c.reference,
    generatedAt: c.generatedAt,
    transaction: { id: row.tx.id, quantityKg: row.tx.quantityKg, totalFcfa: row.tx.totalFcfa, status: row.tx.status },
    offer: {
      typeResidu: row.offer.typeResidu,
      region: row.offer.region,
      description: row.offer.description,
      priceFcfa: row.offer.priceFcfa,
      quantityKg: row.offer.quantityKg,
      disponibilite: row.offer.disponibilite,
    },
    seller: { name: seller!.name, phone: seller!.phone, email: seller!.email, region: (seller as any).region ?? null, verificationLevel: (seller as any).verificationLevel ?? 0 },
    buyer:  { name: buyer!.name,  phone: buyer!.phone,  email: buyer!.email,  region: (buyer as any).region ?? null,  verificationLevel: (buyer as any).verificationLevel ?? 0 },
    sellerSignedAt: c.sellerSignedAt,
    buyerSignedAt: c.buyerSignedAt,
    publicBaseUrl: publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "https://agroloopci.ci",
  });
  await fs.promises.writeFile(c.pdfUrl, buf);
  return c;
}

export function serializeContract(c: typeof contractsTable.$inferSelect) {
  return {
    id: c.id,
    transaction_id: c.transactionId,
    reference: c.reference,
    pdf_url: c.pdfUrl,
    generated_at: c.generatedAt.toISOString(),
    seller_signed_at: c.sellerSignedAt?.toISOString() ?? null,
    buyer_signed_at: c.buyerSignedAt?.toISOString() ?? null,
    status: c.status,
  };
}

export { CONTRACTS_DIR };
