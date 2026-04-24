import type { User } from "@workspace/db";

export function serializeUser(
  user: User,
  extras: { adminRole?: { name: string; label: string } | null; permissions?: Record<string, string[]> } = {},
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    region: user.region,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    filieres: Array.isArray(user.filieres) ? user.filieres : [],
    ratingAvg: Number(user.ratingAvg ?? 0),
    ratingCount: user.ratingCount ?? 0,
    verificationStatus: (user as any).verificationStatus ?? "non_verifie",
    verificationLevel: (user as any).verificationLevel ?? 0,
    verifiedAt: (user as any).verifiedAt ? (user as any).verifiedAt.toISOString() : null,
    isAdminActive: (user as any).isAdminActive ?? true,
    forcePasswordChange: (user as any).forcePasswordChange ?? false,
    lastLogin: (user as any).lastLogin ? (user as any).lastLogin.toISOString() : null,
    adminRole: extras.adminRole ?? null,
    permissions: extras.permissions ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
