import { customFetch } from "@/api-client";

export type NotifType =
  | "nouveau_message"
  | "offre_correspondante"
  | "transaction_confirmee"
  | "transaction_annulee"
  | "nouvel_avis"
  | "offre_expiree"
  | "broadcast";

export interface AppNotification {
  id: number;
  userId: number;
  type: NotifType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsList {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
}

export interface UserPrefs {
  userId?: number;
  filieresSouhaitees: string[];
  residusSouhaites: string[];
  regionsSouhaitees: string[];
  prixMaxFcfa: number | null;
  notifNouveauMessage: boolean;
  notifOffreMatch: boolean;
  notifTransaction: boolean;
  notifAvis: boolean;
}

export async function fetchUnreadCount(): Promise<number> {
  const r = await customFetch<{ count: number }>("/api/notifications/unread-count", { method: "GET" });
  return r.count;
}

export async function fetchNotifications(opts: { page?: number; limit?: number; unread?: boolean; type?: string } = {}): Promise<NotificationsList> {
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.unread) qs.set("unread", "true");
  if (opts.type) qs.set("type", opts.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return customFetch<NotificationsList>(`/api/notifications${suffix}`, { method: "GET" });
}

export function markRead(id: number) {
  return customFetch(`/api/notifications/${id}/read`, { method: "PUT" });
}
export function markAllRead() {
  return customFetch(`/api/notifications/read-all`, { method: "PUT" });
}
export function deleteNotification(id: number) {
  return customFetch(`/api/notifications/${id}`, { method: "DELETE" });
}
export function deleteAllNotifications() {
  return customFetch(`/api/notifications`, { method: "DELETE" });
}

export function fetchPreferences(): Promise<UserPrefs> {
  return customFetch<UserPrefs>("/api/preferences", { method: "GET" });
}

export function updatePreferences(body: Partial<UserPrefs>): Promise<UserPrefs> {
  return customFetch<UserPrefs>("/api/preferences", { method: "PUT", body: JSON.stringify(body) });
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} heure${h > 1 ? "s" : ""}`;
  const d = new Date(iso);
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export const NOTIF_TYPE_META: Record<NotifType, { emoji: string; color: string; bg: string }> = {
  nouveau_message:        { emoji: "💬", color: "text-blue-600",   bg: "bg-blue-50" },
  offre_correspondante:   { emoji: "📦", color: "text-green-600",  bg: "bg-green-50" },
  transaction_confirmee:  { emoji: "🔄", color: "text-green-600",  bg: "bg-green-50" },
  transaction_annulee:    { emoji: "❌", color: "text-red-600",    bg: "bg-red-50" },
  nouvel_avis:            { emoji: "⭐", color: "text-yellow-600", bg: "bg-yellow-50" },
  offre_expiree:          { emoji: "⚠️", color: "text-orange-600", bg: "bg-orange-50" },
  broadcast:              { emoji: "📣", color: "text-gray-600",   bg: "bg-gray-50" },
  support:                { emoji: "🎧", color: "text-purple-600", bg: "bg-purple-50" },
};

export const RESIDU_TYPES = [
  "Cabosses de cacao",
  "Coques d'anacarde",
  "Tiges de plantain",
  "Feuilles de canne à sucre",
  "Marc de café",
  "Écorces de manioc",
  "Pailles de riz",
  "Autre",
] as const;

export const REGIONS = [
  "Abidjan", "Bouaké", "San-Pédro", "Korhogo", "Yamoussoukro",
  "Daloa", "Man", "Gagnoa", "San Pedro", "Sassandra", "Divo",
] as const;

export const FILIERES = ["cacao", "anacarde", "plantain", "café", "manioc", "riz", "canne à sucre"] as const;
