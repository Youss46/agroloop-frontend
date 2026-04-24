import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, MapPin, Calendar, Coins, ArrowDownUp, Loader2, X, Truck } from "lucide-react";
import { useGeolocation } from "@/hooks/use-geolocation";

const RESIDU_TYPES = [
  "Cabosses de cacao",
  "Coques d'anacarde",
  "Tiges de plantain",
  "Feuilles de canne à sucre",
  "Marc de café",
  "Écorces de manioc",
  "Pailles de riz",
  "Autre",
] as const;

const REGIONS = [
  "Abidjan",
  "San Pedro",
  "Abengourou",
  "Bouaké",
  "Korhogo",
  "Yamoussoukro",
  "Autre",
] as const;

export type MarketplaceFiltersState = {
  region: string;
  typeResidu: string;
  radiusKm: number | null;
  disponibilite: "immediate" | "planifiee" | null;
  livraisonPossible: boolean;
  prixMin: number | null;
  prixMax: number | null;
  sortBy: "date" | "prix_asc" | "prix_desc" | "distance";
  lat: number | null;
  lng: number | null;
};

export const DEFAULT_FILTERS: MarketplaceFiltersState = {
  region: "all",
  typeResidu: "all",
  radiusKm: null,
  disponibilite: null,
  livraisonPossible: false,
  prixMin: null,
  prixMax: null,
  sortBy: "date",
  lat: null,
  lng: null,
};

export function activeFilterCount(f: MarketplaceFiltersState): number {
  let n = 0;
  if (f.region !== "all") n++;
  if (f.typeResidu !== "all") n++;
  if (f.radiusKm != null) n++;
  if (f.disponibilite != null) n++;
  if (f.livraisonPossible) n++;
  if (f.prixMin != null || f.prixMax != null) n++;
  if (f.sortBy !== "date") n++;
  return n;
}

type Props = {
  value: MarketplaceFiltersState;
  onChange: (next: MarketplaceFiltersState) => void;
};

const RADIUS_MIN = 5;
const RADIUS_MAX = 300;
const RADIUS_STEP = 5;
const RADIUS_DEFAULT = 50;

export function MarketplaceFilters({ value, onChange }: Props) {
  const set = <K extends keyof MarketplaceFiltersState>(k: K, v: MarketplaceFiltersState[K]) =>
    onChange({ ...value, [k]: v });

  const geo = useGeolocation();

  const [prixMinDraft, setPrixMinDraft] = useState<string>(value.prixMin?.toString() ?? "");
  const [prixMaxDraft, setPrixMaxDraft] = useState<string>(value.prixMax?.toString() ?? "");

  useEffect(() => {
    setPrixMinDraft(value.prixMin?.toString() ?? "");
    setPrixMaxDraft(value.prixMax?.toString() ?? "");
  }, [value.prixMin, value.prixMax]);

  useEffect(() => {
    const t = setTimeout(() => {
      const min = prixMinDraft === "" ? null : Number(prixMinDraft);
      const max = prixMaxDraft === "" ? null : Number(prixMaxDraft);
      if ((min ?? null) !== value.prixMin || (max ?? null) !== value.prixMax) {
        onChange({ ...value, prixMin: Number.isFinite(min as number) ? (min as number) : null, prixMax: Number.isFinite(max as number) ? (max as number) : null });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prixMinDraft, prixMaxDraft]);

  const handleRequestGeo = async () => {
    const c = await geo.request();
    if (c) {
      onChange({ ...value, lat: c.lat, lng: c.lng, radiusKm: value.radiusKm ?? 50 });
    }
  };

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="space-y-2" data-testid="marketplace-filters">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Filtres</h3>
        {activeFilterCount(value) > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} data-testid="button-reset-filters">
            Réinitialiser
          </Button>
        )}
      </div>

      <FilterSection icon={<MapPin className="h-4 w-4" />} title="Type & Région" defaultOpen>
        <div className="space-y-3">
          <Select value={value.typeResidu} onValueChange={(v) => set("typeResidu", v)}>
            <SelectTrigger data-testid="filter-type-residu">
              <SelectValue placeholder="Type de résidu agricole" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {RESIDU_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={value.region} onValueChange={(v) => set("region", v)}>
            <SelectTrigger data-testid="filter-region">
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les régions</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterSection>

      <FilterSection icon={<MapPin className="h-4 w-4" />} title="Localisation">
        <div className="space-y-3">
          {value.lat == null || value.lng == null ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRequestGeo}
              disabled={geo.loading}
              data-testid="button-use-my-location"
            >
              {geo.loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
              Utiliser ma position
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center justify-between bg-muted/40 rounded px-2 py-1">
              <span>Position activée</span>
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => { geo.clear(); onChange({ ...value, lat: null, lng: null, radiusKm: null }); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {geo.error && <p className="text-xs text-destructive">{geo.error}</p>}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Rayon de recherche</p>
              <span className="text-xs font-medium tabular-nums" data-testid="filter-radius-value">
                {value.radiusKm != null ? `${value.radiusKm} km` : "Désactivé"}
              </span>
            </div>
            <Slider
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={[value.radiusKm ?? RADIUS_DEFAULT]}
              onValueChange={(vs) => set("radiusKm", vs[0] ?? null)}
              disabled={value.lat == null || value.lng == null}
              data-testid="filter-radius-slider"
              aria-label="Rayon de recherche en kilomètres"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{RADIUS_MIN} km</span>
              <span>{RADIUS_MAX} km</span>
            </div>
            {value.radiusKm != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 mt-1 text-xs"
                onClick={() => set("radiusKm", null)}
                data-testid="filter-radius-clear"
              >
                Effacer le rayon
              </Button>
            )}
          </div>
        </div>
      </FilterSection>

      <FilterSection icon={<Calendar className="h-4 w-4" />} title="Disponibilité">
        <ToggleGroup
          type="single"
          value={value.disponibilite ?? ""}
          onValueChange={(v) => set("disponibilite", (v as "immediate" | "planifiee") || null)}
          className="flex gap-1"
        >
          <ToggleGroupItem value="immediate" size="sm" data-testid="filter-disponibilite-immediate">Immédiate</ToggleGroupItem>
          <ToggleGroupItem value="planifiee" size="sm" data-testid="filter-disponibilite-planifiee">Planifiée</ToggleGroupItem>
        </ToggleGroup>
      </FilterSection>

      <FilterSection icon={<Truck className="h-4 w-4" />} title="Livraison">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="filter-livraison" className="text-sm font-normal cursor-pointer">
            Livraison possible
          </Label>
          <Switch
            id="filter-livraison"
            checked={value.livraisonPossible}
            onCheckedChange={(c) => set("livraisonPossible", !!c)}
            data-testid="filter-livraison-possible"
          />
        </div>
      </FilterSection>

      <FilterSection icon={<Coins className="h-4 w-4" />} title="Prix (FCFA)">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={prixMinDraft}
            onChange={(e) => setPrixMinDraft(e.target.value)}
            data-testid="filter-prix-min"
          />
          <Input
            type="number"
            placeholder="Max"
            value={prixMaxDraft}
            onChange={(e) => setPrixMaxDraft(e.target.value)}
            data-testid="filter-prix-max"
          />
        </div>
      </FilterSection>

      <FilterSection icon={<ArrowDownUp className="h-4 w-4" />} title="Trier par" defaultOpen>
        <Select value={value.sortBy} onValueChange={(v) => set("sortBy", v as MarketplaceFiltersState["sortBy"])}>
          <SelectTrigger data-testid="filter-sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Plus récentes</SelectItem>
            <SelectItem value="prix_asc">Prix croissant</SelectItem>
            <SelectItem value="prix_desc">Prix décroissant</SelectItem>
            <SelectItem value="distance" disabled={value.lat == null}>Distance</SelectItem>
          </SelectContent>
        </Select>
      </FilterSection>
    </div>
  );
}

function FilterSection({ icon, title, defaultOpen, children }: { icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b border-border/60 py-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium py-1 hover:text-primary">
        <span className="flex items-center gap-2">{icon}{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 pb-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function FilterChips({ value, onChange }: Props) {
  const chips: { label: string; clear: () => void }[] = [];
  if (value.typeResidu !== "all") chips.push({ label: value.typeResidu, clear: () => onChange({ ...value, typeResidu: "all" }) });
  if (value.region !== "all") chips.push({ label: value.region, clear: () => onChange({ ...value, region: "all" }) });
  if (value.radiusKm != null) chips.push({ label: `≤ ${value.radiusKm} km`, clear: () => onChange({ ...value, radiusKm: null }) });
  if (value.disponibilite) chips.push({ label: value.disponibilite === "immediate" ? "Disponible immédiatement" : "Planifiée", clear: () => onChange({ ...value, disponibilite: null }) });
  if (value.livraisonPossible) chips.push({ label: "Livraison possible", clear: () => onChange({ ...value, livraisonPossible: false }) });
  if (value.prixMin != null || value.prixMax != null) {
    const lab = `${value.prixMin ?? "0"} – ${value.prixMax ?? "∞"} FCFA`;
    chips.push({ label: lab, clear: () => onChange({ ...value, prixMin: null, prixMax: null }) });
  }
  if (value.sortBy !== "date") {
    const sortLabels: Record<string, string> = { prix_asc: "Prix ↑", prix_desc: "Prix ↓", distance: "Distance" };
    chips.push({ label: `Tri: ${sortLabels[value.sortBy]}`, clear: () => onChange({ ...value, sortBy: "date" }) });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-4" data-testid="filter-chips">
      {chips.map((c, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
          <span className="text-xs">{c.label}</span>
          <button onClick={c.clear} className="hover:bg-background/40 rounded-full p-0.5" aria-label="Retirer">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
