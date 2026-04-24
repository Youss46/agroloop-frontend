import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userPreferencesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function serializePrefs(p: any) {
  return {
    userId: p.userId,
    filieresSouhaitees: p.filieresSouhaitees ?? [],
    residusSouhaites: p.residusSouhaites ?? [],
    regionsSouhaitees: p.regionsSouhaitees ?? [],
    prixMaxFcfa: p.prixMaxFcfa ?? null,
    notifNouveauMessage: !!p.notifNouveauMessage,
    notifOffreMatch: !!p.notifOffreMatch,
    notifTransaction: !!p.notifTransaction,
    notifAvis: !!p.notifAvis,
  };
}

const DEFAULTS = {
  filieresSouhaitees: [] as string[],
  residusSouhaites: [] as string[],
  regionsSouhaitees: [] as string[],
  prixMaxFcfa: null as number | null,
  notifNouveauMessage: true,
  notifOffreMatch: true,
  notifTransaction: true,
  notifAvis: true,
};

router.get("/preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const [row] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
  if (!row) {
    res.json({ userId, ...DEFAULTS });
    return;
  }
  res.json(serializePrefs(row));
});

router.put("/preferences", requireAuth, async (req, res): Promise<void> => {
  const userId = req.auth!.userId;
  const b = req.body ?? {};

  const sanitizeStrArr = (v: any): string[] | undefined => {
    if (v === undefined) return undefined;
    if (!Array.isArray(v)) return [];
    return v.filter((x: any) => typeof x === "string" && x.length > 0).slice(0, 50);
  };
  const sanitizeBool = (v: any): boolean | undefined => {
    if (v === undefined) return undefined;
    return !!v;
  };
  const sanitizePrice = (v: any): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  };

  const patch: any = { updatedAt: new Date() };
  const f = sanitizeStrArr(b.filieresSouhaitees ?? b.filieres_souhaitees); if (f !== undefined) patch.filieresSouhaitees = f;
  const r2 = sanitizeStrArr(b.residusSouhaites ?? b.residus_souhaites); if (r2 !== undefined) patch.residusSouhaites = r2;
  const reg = sanitizeStrArr(b.regionsSouhaitees ?? b.regions_souhaitees); if (reg !== undefined) patch.regionsSouhaitees = reg;
  const px = sanitizePrice(b.prixMaxFcfa ?? b.prix_max_fcfa); if (px !== undefined) patch.prixMaxFcfa = px;
  const a = sanitizeBool(b.notifNouveauMessage ?? b.notif_nouveau_message); if (a !== undefined) patch.notifNouveauMessage = a;
  const c = sanitizeBool(b.notifOffreMatch ?? b.notif_offre_match); if (c !== undefined) patch.notifOffreMatch = c;
  const d = sanitizeBool(b.notifTransaction ?? b.notif_transaction); if (d !== undefined) patch.notifTransaction = d;
  const e = sanitizeBool(b.notifAvis ?? b.notif_avis); if (e !== undefined) patch.notifAvis = e;

  const [existing] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
  let row;
  if (!existing) {
    [row] = await db.insert(userPreferencesTable).values({ userId, ...DEFAULTS, ...patch }).returning();
  } else {
    [row] = await db.update(userPreferencesTable).set(patch).where(eq(userPreferencesTable.userId, userId)).returning();
  }
  res.json(serializePrefs(row));
});

export default router;
