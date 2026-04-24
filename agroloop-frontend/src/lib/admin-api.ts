import { customFetch } from "@/api-client";

function qs(params: Record<string, any>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  stats: () => customFetch<any>("/api/admin/stats"),

  listUsers: (params: Record<string, any> = {}) =>
    customFetch<{ page: number; pageSize: number; total: number; users: any[] }>(
      `/api/admin/users${qs(params)}`,
    ),
  getUser: (id: number) => customFetch<any>(`/api/admin/users/${id}`),
  banUser: (id: number, reason: string) =>
    customFetch<any>(`/api/admin/users/${id}/ban`, { method: "PUT", body: JSON.stringify({ reason }) }),
  unbanUser: (id: number) => customFetch<any>(`/api/admin/users/${id}/unban`, { method: "PUT", body: JSON.stringify({}) }),
  deleteUser: (id: number) => customFetch<any>(`/api/admin/users/${id}`, { method: "DELETE" }),

  listOffres: (params: Record<string, any> = {}) =>
    customFetch<{ page: number; pageSize: number; total: number; offres: any[] }>(
      `/api/admin/offres${qs(params)}`,
    ),
  setOffreStatus: (id: number, status: string) =>
    customFetch<any>(`/api/admin/offres/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
  deleteOffre: (id: number, reason?: string) =>
    customFetch<any>(`/api/admin/offres/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  bulkOffres: (ids: number[], action: "delete" | "expire") =>
    customFetch<any>(`/api/admin/offres/bulk`, { method: "POST", body: JSON.stringify({ ids, action }) }),

  listTransactions: (params: Record<string, any> = {}) =>
    customFetch<any>(`/api/admin/transactions${qs(params)}`),
  setTransactionStatus: (id: number, status: string) =>
    customFetch<any>(`/api/admin/transactions/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  listRatings: (params: Record<string, any> = {}) =>
    customFetch<any>(`/api/admin/ratings${qs(params)}`),
  flagRating: (id: number, flagged: boolean) =>
    customFetch<any>(`/api/admin/ratings/${id}/flag`, { method: "PUT", body: JSON.stringify({ flagged }) }),
  deleteRating: (id: number) => customFetch<any>(`/api/admin/ratings/${id}`, { method: "DELETE" }),

  broadcastPreview: (audience: string, audienceValue?: string) =>
    customFetch<{ count: number }>(`/api/admin/broadcast/preview`, { method: "POST", body: JSON.stringify({ audience, audienceValue }) }),
  broadcast: (data: { title: string; message: string; audience: string; audienceValue?: string }) =>
    customFetch<{ id: number; reach: number }>(`/api/admin/broadcast`, { method: "POST", body: JSON.stringify(data) }),
  broadcastHistory: () => customFetch<any[]>(`/api/admin/broadcast`),

  logs: (params: Record<string, any> = {}) =>
    customFetch<any>(`/api/admin/logs${qs(params)}`),

  listFlaggedOffers: (params: Record<string, any> = {}) =>
    customFetch<{ flags: any[] }>(`/api/admin/flagged-offers${qs(params)}`),
  reviewFlaggedOffer: (id: number, data: { decision: string; removeOffer: boolean }) =>
    customFetch<any>(`/api/admin/flagged-offers/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // ── Team management ──
  team: {
    list: (params: Record<string, any> = {}) =>
      customFetch<{ admins: AdminTeamMember[]; total: number; page: number; pageSize: number }>(`/api/admin/team${qs(params)}`),
    roles: () => customFetch<AdminRoleDef[]>("/api/admin/team/roles"),
    invite: (data: { name: string; email: string; password: string; role: string }) =>
      customFetch<any>("/api/admin/team/invite", { method: "POST", body: JSON.stringify(data) }),
    changeRole: (id: number, role: string) =>
      customFetch<any>(`/api/admin/team/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    deactivate: (id: number) =>
      customFetch<any>(`/api/admin/team/${id}/deactivate`, { method: "PUT", body: JSON.stringify({}) }),
    activate: (id: number) =>
      customFetch<any>(`/api/admin/team/${id}/activate`, { method: "PUT", body: JSON.stringify({}) }),
    remove: (id: number) =>
      customFetch<any>(`/api/admin/team/${id}`, { method: "DELETE" }),
    activity: (id: number) =>
      customFetch<AdminActivityEntry[]>(`/api/admin/team/${id}/activity`),
  },
  profile: {
    update: (data: { name: string }) =>
      customFetch<any>("/api/admin/profile", { method: "PUT", body: JSON.stringify(data) }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      customFetch<{ success: boolean; token?: string }>("/api/admin/profile/password", { method: "PUT", body: JSON.stringify(data) }),
  },
};

export interface AdminTeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  admin_role: { name: string; label: string; description: string | null } | null;
  is_admin_active: boolean;
  last_login: string | null;
  created_at: string;
  created_by_id: number | null;
  created_by_name: string | null;
  force_password_change: boolean;
}

export interface AdminRoleDef {
  id: number;
  name: string;
  label: string;
  description: string | null;
  permissions: Record<string, string[]>;
}

export interface AdminActivityEntry {
  id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: any;
  created_at: string;
}
