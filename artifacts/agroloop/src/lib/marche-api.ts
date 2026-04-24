import { customFetch } from "@workspace/api-client-react";

export type PrixActuel = {
  typeResidu: string;
  prixMoyen: number;
  prixMin: number;
  prixMax: number;
  nbOffres: number;
};

export type HistoriquePoint = {
  semaine: string;
  typeResidu: string;
  prixMoyen: number;
  prixMin: number;
  prixMax: number;
  volumeKg: number;
  nbTransactions: number;
};

export type HistoriqueResponse = {
  periode: number;
  typeResidu: string | null;
  region: string | null;
  series: HistoriquePoint[];
  summary: {
    prixMoyenActuel: number;
    variationPct: number;
    volumeTotal: number;
    nbTransactionsTotal: number;
  };
};

export type SyntheseItem = {
  typeResidu: string;
  prixMoyen: number;
  variationPct: number;
  volumeKg: number;
  nbTransactions: number;
};

export const marcheApi = {
  prixActuels: (typeResidu?: string) => {
    const q = typeResidu
      ? `?type_residu=${encodeURIComponent(typeResidu)}`
      : "";
    return customFetch<{ prixActuels: PrixActuel[] }>(
      `/api/marche/prix-actuels${q}`,
    );
  },
  historique: (params: {
    type_residu?: string;
    periode?: number;
    region?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.type_residu) qs.set("type_residu", params.type_residu);
    if (params.periode) qs.set("periode", String(params.periode));
    if (params.region) qs.set("region", params.region);
    const q = qs.toString();
    return customFetch<HistoriqueResponse>(
      `/api/marche/prix-historique${q ? "?" + q : ""}`,
    );
  },
  synthese: () =>
    customFetch<{ synthese: SyntheseItem[] }>("/api/marche/synthese"),
};
