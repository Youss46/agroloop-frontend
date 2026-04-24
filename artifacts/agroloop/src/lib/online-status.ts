import { customFetch } from "@workspace/api-client-react";

export type UserStatus = {
  is_online: boolean;
  last_seen: string | null;
  status_label: string;
};

export const onlineStatusApi = {
  get: (userId: number) => customFetch<UserStatus>(`/api/users/${userId}/status`),
};

export function computeStatusLabel(lastSeen: string | null | undefined, isOnline: boolean): string {
  if (isOnline) return "En ligne";
  if (!lastSeen) return "Hors ligne";
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const min = Math.floor(diffMs / 60_000);
  const h = Math.floor(diffMs / 3_600_000);
  const d = Math.floor(diffMs / 86_400_000);
  if (min < 60) return `Vu il y a ${Math.max(1, min)} min`;
  if (h < 24) return `Vu il y a ${h}h`;
  if (d < 7) return `Vu il y a ${d} jour${d > 1 ? "s" : ""}`;
  return "Vu il y a plus d'une semaine";
}

export function isOnlineFromLastSeen(lastSeen: string | null | undefined, showOnline: boolean | null | undefined): boolean {
  if (showOnline === false) return false;
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 3 * 60_000;
}
