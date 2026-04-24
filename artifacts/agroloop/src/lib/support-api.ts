import { customFetch } from "@workspace/api-client-react";

export type SupportStatus = "ouvert" | "en_cours" | "resolu" | "ferme";
export type SupportCategory =
  | "compte"
  | "verification"
  | "paiement"
  | "offre"
  | "commande"
  | "technique"
  | "autre";

export interface SupportTicket {
  id: number;
  userId: number;
  subject: string;
  category: SupportCategory;
  message: string;
  status: SupportStatus;
  adminResponse: string | null;
  handledByAdminId: number | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; email: string; role: string };
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  compte: "Compte",
  verification: "Vérification",
  paiement: "Paiement / Abonnement",
  offre: "Offre",
  commande: "Commande / Devis",
  technique: "Problème technique",
  autre: "Autre",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

export async function createSupportTicket(body: {
  subject: string;
  category: SupportCategory;
  message: string;
}): Promise<SupportTicket> {
  return customFetch<SupportTicket>("/api/support/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchMyTickets(): Promise<{ items: SupportTicket[] }> {
  return customFetch<{ items: SupportTicket[] }>("/api/support/tickets/mine", { method: "GET" });
}

export interface SupportSettings {
  whatsappNumber: string;
  whatsappDisplay: string;
  supportEmail: string;
  supportHours: string;
}

export async function fetchSupportSettings(): Promise<SupportSettings> {
  return customFetch<SupportSettings>("/api/support/settings", { method: "GET" });
}

export interface AdminSupportSettings {
  whatsappNumber: string;
  supportEmail: string;
  supportHours: string;
}

export async function fetchAdminSupportSettings(): Promise<AdminSupportSettings> {
  return customFetch<AdminSupportSettings>("/api/admin/support/settings", { method: "GET" });
}

export async function updateAdminSupportSettings(
  body: Partial<AdminSupportSettings>,
): Promise<AdminSupportSettings> {
  return customFetch<AdminSupportSettings>("/api/admin/support/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function fetchAdminTickets(status?: SupportStatus): Promise<{ items: SupportTicket[] }> {
  const qs = status ? `?status=${status}` : "";
  return customFetch<{ items: SupportTicket[] }>(`/api/admin/support/tickets${qs}`, { method: "GET" });
}

export async function updateAdminTicket(
  id: number,
  body: { status?: SupportStatus; adminResponse?: string },
): Promise<SupportTicket> {
  return customFetch<SupportTicket>(`/api/admin/support/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
