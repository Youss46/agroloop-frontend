import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const isProd = process.env.NODE_ENV === "production";

function trustedIp(req: Request): string {
  return ipKeyGenerator(req.ip || "unknown");
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 10 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `login:${trustedIp(req)}:${email}`;
  },
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProd ? 50 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `loginip:${trustedIp(req)}`,
  message: { error: "Trop de tentatives depuis cette adresse. Réessayez plus tard." },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProd ? 5 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `register:${trustedIp(req)}`,
  message: { error: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard." },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProd ? 5 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
    return `pwreset:${trustedIp(req)}:${email}`;
  },
  message: { error: "Trop de demandes. Réessayez dans 1 heure." },
});

export const adminInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isProd ? 30 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as Request & { auth?: { userId: number } }).auth?.userId ?? "anon";
    return `invite:${userId}`;
  },
  message: { error: "Trop d'invitations envoyées. Réessayez plus tard." },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isProd ? 60 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as Request & { auth?: { userId: number } }).auth?.userId;
    return userId ? `write:user:${userId}` : `write:ip:${trustedIp(req)}`;
  },
  message: { error: "Trop de requêtes. Ralentissez et réessayez dans une minute." },
});
