import { customFetch } from "@/api-client";

export type PlanFeatures = {
  contacts_illimites: boolean;
  alertes_matching: boolean;
  telechargement_contrats: boolean;
  filtre_distance: boolean;
  rapports_filiere: boolean;
  api_access: boolean;
  badge_pro: boolean;
  account_manager: boolean;
};

export type Plan = {
  id: number;
  name: "gratuit" | "pro" | "business";
  label?: string;
  price_fcfa: number;
  contacts_per_month: number;
  features: PlanFeatures;
  description: string;
  is_popular: boolean;
  is_active?: boolean;
  updated_at?: string | null;
  updated_by?: number | null;
};

export type PriceHistoryEntry = {
  old_price: number;
  new_price: number;
  changed_by: number;
  changed_by_name?: string | null;
  changed_at: string;
  reason: string;
};

export type AdminPlan = Plan & {
  is_active: boolean;
  updated_at: string | null;
  updated_by: number | null;
  updated_by_name: string | null;
  price_history: PriceHistoryEntry[];
  active_subscribers: number;
};

export type SubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "en_attente_validation"
  | "rejeté";

export type Subscription = {
  id: number;
  user_id: number;
  plan_id: number;
  plan_name: string | null;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  payment_method: string;
  payment_reference: string | null;
  cancelled_at: string | null;
  created_at?: string;
};

export type SubscriptionMe = {
  plan: Plan;
  subscription: Subscription | null;
  pending_subscription: Subscription | null;
  usage: { contacts_used: number; contacts_limit: number; month: string };
};

export type Invoice = {
  id: number;
  reference: string;
  amount_fcfa: number;
  plan_name: string;
  period_start: string;
  period_end: string;
  status: "payée" | "en_attente" | "annulée";
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PaymentMethod = "orange_money" | "wave" | "mtn_money" | "virement" | "autre";

export type PublicPaymentSetting = {
  method: PaymentMethod;
  label: string;
  account_name: string;
  number: string;
  instructions: string | null;
  position: number;
};

export type AdminPaymentSetting = PublicPaymentSetting & {
  id: number;
  is_active: boolean;
  updated_at: string;
  updated_by: number | null;
  updated_by_name: string | null;
};

export const paymentSettingsApi = {
  listPublic: () => customFetch<PublicPaymentSetting[]>("/api/payment-settings"),
  adminList: () => customFetch<AdminPaymentSetting[]>("/api/admin/payment-settings"),
  create: (body: {
    method: PaymentMethod; label: string; account_name: string; number: string;
    instructions: string | null; is_active: boolean;
  }) =>
    customFetch<{ success: boolean; setting: AdminPaymentSetting }>(`/api/admin/payment-settings`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: {
    label: string; account_name: string; number: string;
    instructions: string | null; is_active: boolean; position?: number;
  }) =>
    customFetch<{ success: boolean; setting: AdminPaymentSetting }>(`/api/admin/payment-settings/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    customFetch<{ deleted: boolean }>(`/api/admin/payment-settings/${id}`, {
      method: "DELETE",
    }),
  reorder: (ordered_ids: number[]) =>
    customFetch<{ success: boolean }>(`/api/admin/payment-settings/reorder`, {
      method: "PUT",
      body: JSON.stringify({ ordered_ids }),
    }),
};

export const subscriptionsApi = {
  listPlans: () => customFetch<Plan[]>("/api/plans"),
  me: () => customFetch<SubscriptionMe>("/api/subscription/me"),
  subscribe: (params: {
    plan_name: "pro" | "business";
    payment_method: PaymentMethod;
    payment_reference?: string;
    payment_proof_base64: string;
    payment_proof_filename: string;
  }) =>
    customFetch<{ subscription: Subscription; invoice: Invoice; plan: Plan; pending: boolean }>("/api/subscribe", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  adminListPlans: () => customFetch<AdminPlan[]>("/api/admin/plans"),
  adminUpdatePlan: (id: number, body: {
    label: string;
    description: string;
    price_fcfa: number;
    contacts_per_month: number;
    is_active: boolean;
    features?: PlanFeatures;
    reason: string;
  }) =>
    customFetch<{ success: boolean; plan: AdminPlan }>(`/api/admin/plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  adminPlanHistory: (id: number) =>
    customFetch<{ plan_name: string; plan_label: string; history: PriceHistoryEntry[] }>(
      `/api/admin/plans/${id}/history`,
    ),
  adminViewProof: (id: number) =>
    customFetch<{
      payment_proof_url: string;
      payment_proof_filename: string | null;
      payment_proof_uploaded_at: string | null;
    }>(`/api/admin/subscriptions/${id}/proof`),
  adminConfirmSubscription: (id: number) =>
    customFetch<{ subscription: Subscription; invoice: Invoice | null }>(
      `/api/admin/subscriptions/${id}/confirm`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  adminRejectSubscription: (id: number, reason: string) =>
    customFetch<{ subscription: Subscription }>(
      `/api/admin/subscriptions/${id}/reject`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  cancel: () =>
    customFetch<{ subscription: Subscription }>("/api/subscription/cancel", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  invoices: () => customFetch<Invoice[]>("/api/invoices"),
  adminList: (params: { status?: string; plan?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.plan) qs.set("plan", params.plan);
    const s = qs.toString();
    return customFetch<{
      subscriptions: any[];
      stats: { total_active: number; total_pending: number; total_revenue_fcfa: number };
    }>(`/api/admin/subscriptions${s ? `?${s}` : ""}`);
  },
  adminFinanceMetrics: (months = 12) =>
    customFetch<{
      months: number;
      mrr_series: { month: string; mrr_total: number; mrr_pro: number; mrr_business: number }[];
      forecast: { month: string; mrr_total: number }[];
      churn_series: { month: string; cancelled: number; active_at_start: number; churn_rate: number }[];
      segments: {
        pro: { active: number; mrr: number; arpu: number; ltv: number; lifetime_months: number };
        business: { active: number; mrr: number; arpu: number; ltv: number; lifetime_months: number };
      };
      summary: {
        mrr_current: number;
        mrr_previous: number;
        mrr_mom_growth: number;
        avg_churn_rate: number;
        total_active: number;
        total_ltv_weighted: number;
      };
    }>(`/api/admin/finance/metrics?months=${months}`),
};

export function downloadInvoiceUrl(id: number): string {
  return `${import.meta.env.BASE_URL}api/invoices/${id}/download`;
}

export async function downloadInvoice(id: number, reference: string): Promise<void> {
  const token = localStorage.getItem("agroloop_token");
  const res = await fetch(downloadInvoiceUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Téléchargement impossible");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${reference}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const PLAN_LABELS: Record<string, string> = {
  gratuit: "Gratuit",
  pro: "Pro",
  business: "Business",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  wave: "Wave",
  mtn_money: "MTN Money",
  virement: "Virement bancaire",
};
