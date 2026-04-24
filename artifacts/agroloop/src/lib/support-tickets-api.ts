import { customFetch } from "@workspace/api-client-react";

export type TicketStatus = "ouvert" | "en_cours" | "resolu" | "ferme" | "spam" | "doublon";
export type TicketPriority = "normale" | "haute" | "urgente";
export type SlaStatus = "ok" | "warning" | "breached" | "none";

export interface SupportCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  sla_hours: number;
  is_active: boolean;
  position: number;
}

export interface SupportTicket {
  id: number;
  reference: string | null;
  user_id: number;
  sujet: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  category_id: number | null;
  category: string | null;
  assigned_to: number | null;
  merged_into: number | null;
  resolved_at: string | null;
  closed_at: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_status: SlaStatus;
  created_at: string;
  updated_at: string;
  user?: { id: number; name: string; email: string; role: string } | null;
  category_obj?: SupportCategory | null;
  assignee?: { id: number; name: string } | null;
  reply_count?: number;
  last_reply_at?: string | null;
}

export interface SupportReply {
  id: number;
  ticket_id: number;
  sender_id: number;
  message: string;
  is_internal_note: boolean;
  is_template_reply: boolean;
  notification_sent: boolean;
  created_at: string;
  sender?: { id: number; name: string; role: string } | null;
}

export interface SupportTemplate {
  id: number;
  title: string;
  content: string;
  category_id: number | null;
  category: SupportCategory | null;
  usage_count: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketHistoryEntry {
  id: number;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  actor_name: string;
  created_at: string;
}

export interface SupportStats {
  today: { new: number; resolved: number; avg_response_min: number };
  week: { new: number; resolved: number; breach_count: number };
  month: { new: number; resolved: number; breach_count: number };
  by_category: Array<{ name: string; icon: string; color: string; count: number; avg_hours: number }>;
  by_agent: Array<{ admin_id: number; admin_name: string; resolved: number; avg_hours: number }>;
  open_by_priority: { normale: number; haute: number; urgente: number };
  sla: { total: number; breached: number; breach_rate: number };
  counts: { ouvert: number; en_cours: number; resolu: number; ferme: number; spam: number };
}

const json = (body: unknown) => ({ method: undefined, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export const supportApi = {
  // Categories
  listCategoriesPublic: () => customFetch<{ items: SupportCategory[] }>("/api/support/categories"),
  listCategoriesAdmin: () => customFetch<{ items: SupportCategory[] }>("/api/admin/support/categories"),
  createCategory: (body: Partial<SupportCategory>) =>
    customFetch<{ category: SupportCategory }>("/api/admin/support/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  updateCategory: (id: number, body: Partial<SupportCategory>) =>
    customFetch<{ category: SupportCategory }>(`/api/admin/support/categories/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  deleteCategory: (id: number) =>
    customFetch<{ ok: boolean }>(`/api/admin/support/categories/${id}`, { method: "DELETE" }),

  // Tickets
  listTickets: (filters: {
    q?: string; status?: string; priority?: string; category_id?: number;
    assigned_to?: string | number; sla_breached?: boolean;
    date_from?: string; date_to?: string; page?: number; page_size?: number;
  } = {}) =>
    customFetch<{ page: number; pageSize: number; total: number; items: SupportTicket[] }>(
      `/api/admin/support/tickets${qs(filters as any)}`,
    ),
  getTicket: (id: number) =>
    customFetch<{ ticket: SupportTicket; replies: SupportReply[]; history: TicketHistoryEntry[] }>(`/api/admin/support/tickets/${id}`),
  reply: (id: number, message: string, isInternal = false, templateId?: number) =>
    customFetch<{ reply: SupportReply; ticket_status: TicketStatus }>(`/api/admin/support/tickets/${id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, is_internal_note: isInternal, template_id: templateId }),
    }),
  setStatus: (id: number, status: TicketStatus, note?: string) =>
    customFetch<{ ticket: SupportTicket }>(`/api/admin/support/tickets/${id}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    }),
  assign: (id: number, adminId: number | null) =>
    customFetch<{ ticket: SupportTicket }>(`/api/admin/support/tickets/${id}/assign`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_id: adminId }),
    }),
  setPriority: (id: number, priority: TicketPriority) =>
    customFetch<{ ticket: SupportTicket }>(`/api/admin/support/tickets/${id}/priority`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    }),
  merge: (id: number, mergeIntoId: number) =>
    customFetch<{ ticket: SupportTicket }>(`/api/admin/support/tickets/${id}/merge`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_into_id: mergeIntoId }),
    }),
  remove: (id: number) =>
    customFetch<{ ok: boolean }>(`/api/admin/support/tickets/${id}`, { method: "DELETE" }),

  // Stats
  stats: () => customFetch<SupportStats>("/api/admin/support/stats"),

  // Templates
  listTemplates: () => customFetch<{ items: SupportTemplate[] }>("/api/admin/support/templates"),
  createTemplate: (body: { title: string; content: string; category_id?: number | null }) =>
    customFetch<{ template: SupportTemplate }>("/api/admin/support/templates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  updateTemplate: (id: number, body: Partial<{ title: string; content: string; category_id: number | null }>) =>
    customFetch<{ template: SupportTemplate }>(`/api/admin/support/templates/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }),
  deleteTemplate: (id: number) =>
    customFetch<{ ok: boolean }>(`/api/admin/support/templates/${id}`, { method: "DELETE" }),

  // User
  myTickets: () => customFetch<{ items: SupportTicket[] }>("/api/support/tickets/mes-tickets"),
  myTicketDetail: (id: number) =>
    customFetch<{ ticket: SupportTicket; replies: SupportReply[] }>(`/api/support/tickets/${id}`),
  userReply: (id: number, message: string) =>
    customFetch<{ reply: SupportReply; ticket_status: TicketStatus }>(`/api/support/tickets/${id}/reply`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
    }),
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
  spam: "Spam",
  doublon: "Doublon",
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  ouvert: "bg-red-100 text-red-700 border-red-200",
  en_cours: "bg-amber-100 text-amber-700 border-amber-200",
  resolu: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ferme: "bg-gray-100 text-gray-600 border-gray-200",
  spam: "bg-purple-100 text-purple-700 border-purple-200",
  doublon: "bg-blue-100 text-blue-700 border-blue-200",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  normale: "Normale", haute: "Haute", urgente: "Urgente",
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  normale: "bg-gray-100 text-gray-600",
  haute: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};
