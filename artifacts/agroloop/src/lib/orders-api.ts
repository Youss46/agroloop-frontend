import { customFetch } from "@workspace/api-client-react";

// ═══ Types ═══════════════════════════════════════════════════════════════════
export type OrderStatus = "en_attente" | "partiellement_confirmée" | "confirmée" | "annulée";
export type OrderItemStatus = "en_attente" | "acceptée" | "refusée" | "contre_proposée";

export type CartItem = {
  id: number;
  offre_id: number;
  quantity_kg: number;
  note: string | null;
  added_at: string;
  offer: {
    id: number;
    type_residu: string;
    description: string | null;
    quantity_kg_available: number;
    unit_price_fcfa: number;
    region: string | null;
    status: string;
    cover_photo_url: string | null;
  };
  line_total_fcfa: number;
};

export type CartGroup = {
  producteur: { id: number; name: string; verification_level: number; region: string | null };
  items: CartItem[];
  subtotal_fcfa: number;
};

export type Cart = {
  groups: CartGroup[];
  item_count: number;
  seller_count: number;
  grand_total_fcfa: number;
};

export type Order = {
  id: number;
  transformateur_id: number;
  reference: string;
  status: OrderStatus;
  total_fcfa: number;
  note_globale: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
  sellers_count?: number;
  pending_count?: number;
};

export type OrderItem = {
  id: number;
  order_id: number;
  offre_id: number;
  producteur_id: number;
  quantity_kg: number;
  unit_price_fcfa: number;
  total_fcfa: number;
  status: OrderItemStatus;
  counter_quantity_kg: number | null;
  counter_price_fcfa: number | null;
  counter_note: string | null;
  responded_at: string | null;
  created_at: string;
};

export type OrderDetail = Order & {
  buyer: { id: number; name: string; phone: string | null; verificationLevel: number } | null;
  items: Array<OrderItem & {
    offer: { id: number; type_residu: string; description: string | null; region: string; cover_photo_url: string | null };
    producteur: { id: number; name: string; phone: string | null; verificationLevel: number; region: string | null } | null;
  }>;
};

// Response shape of POST /api/orders (no buyer/offer/producteur nesting — just order + flat items)
export type CreateOrderResponse = Order & { items: OrderItem[] };

export type ReceivedOrderItem = OrderItem & {
  order: { id: number; reference: string; note_globale: string | null; created_at: string } | null;
  buyer: { id: number; name: string; verification_level: number } | null;
  offer: { id: number; type_residu: string; region: string; cover_photo_url: string | null };
};

// ═══ API ═════════════════════════════════════════════════════════════════════
export const cartApi = {
  get: () => customFetch<Cart>("/api/cart"),
  count: () => customFetch<{ count: number }>("/api/cart/count"),
  add: (body: { offre_id: number; quantity_kg: number; note?: string }) =>
    customFetch<Cart>("/api/cart/add", { method: "POST", body: JSON.stringify(body) }),
  update: (offreId: number, body: { quantity_kg: number; note?: string }) =>
    customFetch<Cart>(`/api/cart/items/${offreId}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (offreId: number) =>
    customFetch<Cart>(`/api/cart/items/${offreId}`, { method: "DELETE" }),
  clear: () =>
    customFetch<Cart>("/api/cart/clear", { method: "DELETE" }),
};

export const ordersApi = {
  create: (body: { note_globale?: string }) =>
    customFetch<CreateOrderResponse>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  list: (status?: string) =>
    customFetch<Order[]>(`/api/orders${status && status !== "tous" ? `?status=${encodeURIComponent(status)}` : ""}`),
  detail: (id: number) => customFetch<OrderDetail>(`/api/orders/${id}`),
  received: (status?: string) =>
    customFetch<ReceivedOrderItem[]>(`/api/orders/received${status && status !== "tous" ? `?status=${encodeURIComponent(status)}` : ""}`),
  respond: (itemId: number, body: {
    action: "accepter" | "refuser" | "contre_proposer";
    counter_quantity_kg?: number;
    counter_price_fcfa?: number;
    counter_note?: string;
  }) => customFetch<OrderItem>(`/api/orders/items/${itemId}/respond`, { method: "PUT", body: JSON.stringify(body) }),
  counterRespond: (itemId: number, body: { action: "accepter" | "refuser" }) =>
    customFetch<OrderItem>(`/api/orders/items/${itemId}/counter-respond`, { method: "PUT", body: JSON.stringify(body) }),
};

// ═══ UI helpers ══════════════════════════════════════════════════════════════
export function formatFcfa(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export function orderStatusLabel(s: OrderStatus): { label: string; color: string; emoji: string } {
  switch (s) {
    case "en_attente": return { label: "En attente", color: "bg-amber-100 text-amber-800 border-amber-300", emoji: "⏳" };
    case "partiellement_confirmée": return { label: "Partiellement confirmée", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "🔄" };
    case "confirmée": return { label: "Confirmée", color: "bg-emerald-100 text-emerald-800 border-emerald-300", emoji: "✅" };
    case "annulée": return { label: "Annulée", color: "bg-red-100 text-red-800 border-red-300", emoji: "❌" };
  }
}

export function orderItemStatusLabel(s: OrderItemStatus): { label: string; color: string; emoji: string } {
  switch (s) {
    case "en_attente": return { label: "En attente", color: "bg-amber-100 text-amber-800 border-amber-300", emoji: "🟡" };
    case "acceptée": return { label: "Acceptée", color: "bg-emerald-100 text-emerald-800 border-emerald-300", emoji: "✅" };
    case "refusée": return { label: "Refusée", color: "bg-red-100 text-red-800 border-red-300", emoji: "❌" };
    case "contre_proposée": return { label: "Contre-proposition", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "🔄" };
  }
}

export function countdown48h(createdAt: string): { text: string; color: string; expired: boolean } {
  const expiresAt = new Date(createdAt).getTime() + 48 * 60 * 60 * 1000;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return { text: "Expiré", color: "text-gray-500", expired: true };
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const color = hours < 3 ? "text-red-600" : hours < 12 ? "text-orange-600" : "text-emerald-600";
  if (hours > 0) return { text: `Il reste ${hours}h ${minutes}min`, color, expired: false };
  return { text: `Il reste ${minutes}min`, color, expired: false };
}
