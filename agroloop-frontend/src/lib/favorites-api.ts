import { customFetch } from "@/api-client";

export type FavoriteOffre = {
  favId: number;
  id: number;
  type_residu: string;
  quantity_kg: number;
  price_fcfa: number;
  region: string;
  status: "disponible" | "vendu" | "expiré";
  share_count: number;
  view_count: number;
  coverPhoto: string | null;
  sellerId: number | null;
  sellerName: string | null;
  sellerVerificationLevel: number | null;
  sellerLastSeen: string | null;
  sellerShowOnline: boolean | null;
  createdAt: string | null;
  favoritedAt: string;
};

export type FavoriteProducteur = {
  favId: number;
  id: number;
  name: string;
  region: string | null;
  avatarUrl: string | null;
  bio: string | null;
  filieres: string[];
  ratingAvg: number;
  ratingCount: number;
  verificationLevel: number;
  activeOffres: number;
  lastSeen: string | null;
  showOnlineStatus: boolean;
  favoritedAt: string;
};

export const favoritesApi = {
  list: () =>
    customFetch<{ offres: FavoriteOffre[]; producteurs: FavoriteProducteur[] }>(
      "/api/favorites",
    ),
  add: (body: { type: "offre"; offre_id: number } | { type: "producteur"; producteur_id: number }) =>
    customFetch<{ favorited: true }>("/api/favorites", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  remove: (type: "offre" | "producteur", id: number) =>
    customFetch<{ favorited: false }>(`/api/favorites/${type}/${id}`, {
      method: "DELETE",
    }),
  check: (type: "offre" | "producteur", id: number) =>
    customFetch<{ favorited: boolean }>(`/api/favorites/check/${type}/${id}`),
  count: () => customFetch<{ count: number }>("/api/favorites/count"),
};
