import type { Request, Response, NextFunction } from "express";
import { checkFeatureAccess, type FeatureKey } from "../lib/subscriptions";

export function requireFeature(feature: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.auth) { res.status(401).json({ error: "Non autorisé" }); return; }
    // Producteurs and admins are not subject to feature gates.
    if (req.auth.role !== "transformateur") { next(); return; }
    const ok = await checkFeatureAccess(req.auth.userId, feature);
    if (!ok) {
      res.status(403).json({
        error: "FEATURE_LOCKED",
        message: "Cette fonctionnalité nécessite un abonnement Pro",
        feature,
        upgrade_url: "/abonnement",
      });
      return;
    }
    next();
  };
}
