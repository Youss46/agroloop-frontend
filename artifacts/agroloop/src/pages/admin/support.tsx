import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search, AlertTriangle, CheckCircle2, Loader2, Inbox, Filter, X,
} from "lucide-react";
import {
  supportApi, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  type SupportTicket, type TicketStatus,
} from "@/lib/support-tickets-api";
import { useAuth } from "@/components/auth-provider";

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR");
}

function SlaBadge({ status, deadline }: { status: string; deadline: string | null }) {
  if (status === "none") return null;
  if (status === "breached") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><AlertTriangle className="h-3 w-3" />SLA dépassé</Badge>;
  if (status === "warning") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">SLA bientôt</Badge>;
  return null;
}

export default function AdminSupportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [slaOnly, setSlaOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery({ queryKey: ["support-stats"], queryFn: () => supportApi.stats() });
  const { data: cats } = useQuery({ queryKey: ["support-cats-admin"], queryFn: () => supportApi.listCategoriesAdmin() });

  const filters = useMemo(() => ({
    q: search || undefined,
    status: statusTab !== "all" ? statusTab : undefined,
    category_id: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    assigned_to: assignedFilter !== "all" ? assignedFilter : undefined,
    sla_breached: slaOnly || undefined,
    page,
    page_size: 20,
  }), [search, statusTab, categoryFilter, priorityFilter, assignedFilter, slaOnly, page]);

  const { data: list, isLoading } = useQuery({
    queryKey: ["support-tickets", filters],
    queryFn: () => supportApi.listTickets(filters as any),
  });

  const tickets = list?.items ?? [];
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const resetFilters = () => {
    setSearch(""); setCategoryFilter("all"); setPriorityFilter("all"); setAssignedFilter("all"); setSlaOnly(false); setPage(1);
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-support-page">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">🎧 Support — Tickets</h1>
            <p className="text-sm text-muted-foreground">Gérez les demandes des utilisateurs.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/support/configuration">
              <Button variant="outline" size="sm">⚙️ Configuration</Button>
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">🔴 Ouverts</div>
            <div className="text-2xl font-bold mt-1">{stats?.counts.ouvert ?? 0}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">🟡 En cours</div>
            <div className="text-2xl font-bold mt-1">{stats?.counts.en_cours ?? 0}</div>
          </CardContent></Card>
          <Card className={stats && stats.sla.breached > 0 ? "border-red-300 bg-red-50/50" : ""}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> SLA dépassés
              </div>
              <div className={`text-2xl font-bold mt-1 ${stats && stats.sla.breached > 0 ? "text-red-700" : ""}`}>
                {stats?.sla.breached ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">✅ Résolus aujourd'hui</div>
            <div className="text-2xl font-bold mt-1 text-emerald-700">{stats?.today.resolved ?? 0}</div>
          </CardContent></Card>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Référence, sujet, nom ou email…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44" data-testid="filter-category"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {cats?.items.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36" data-testid="filter-priority"><SelectValue placeholder="Priorité" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="urgente">🔴 Urgente</SelectItem>
                  <SelectItem value="haute">🟠 Haute</SelectItem>
                  <SelectItem value="normale">⚪ Normale</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v); setPage(1); }}>
                <SelectTrigger className="w-44" data-testid="filter-assignee"><SelectValue placeholder="Assigné à" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="me">Moi</SelectItem>
                  <SelectItem value="unassigned">Non assignés</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={slaOnly ? "default" : "outline"}
                size="sm"
                onClick={() => { setSlaOnly((v) => !v); setPage(1); }}
                data-testid="filter-sla"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                SLA dépassé
              </Button>
              {(search || categoryFilter !== "all" || priorityFilter !== "all" || assignedFilter !== "all" || slaOnly) && (
                <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="filter-reset">
                  <X className="h-3 w-3 mr-1" />Réinitialiser
                </Button>
              )}
            </div>

            <Tabs value={statusTab} onValueChange={(v) => { setStatusTab(v); setPage(1); }}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">Tous</TabsTrigger>
                <TabsTrigger value="ouvert" data-testid="tab-ouvert">Ouverts ({stats?.counts.ouvert ?? 0})</TabsTrigger>
                <TabsTrigger value="en_cours" data-testid="tab-en-cours">En cours ({stats?.counts.en_cours ?? 0})</TabsTrigger>
                <TabsTrigger value="resolu" data-testid="tab-resolu">Résolus</TabsTrigger>
                <TabsTrigger value="ferme" data-testid="tab-ferme">Fermés</TabsTrigger>
                <TabsTrigger value="spam" data-testid="tab-spam">Spam</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Tickets list */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                Aucun ticket trouvé.
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((t: SupportTicket) => <TicketRow key={t.id} t={t} />)}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{total} ticket(s) — page {page}/{totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function TicketRow({ t }: { t: SupportTicket }) {
  const cat = t.category_obj;
  return (
    <Link href={`/admin/support/${t.id}`}>
      <a className="block p-4 hover:bg-muted/40 cursor-pointer transition-colors" data-testid={`ticket-row-${t.id}`}>
        <div className="flex items-start gap-3">
          {cat && (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
            >
              {cat.icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">{t.reference}</span>
              <Badge variant="outline" className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
              {t.priority !== "normale" && (
                <Badge variant="outline" className={PRIORITY_COLORS[t.priority]}>
                  {t.priority === "urgente" ? "🔴" : "🟠"} {PRIORITY_LABELS[t.priority]}
                </Badge>
              )}
              <SlaBadge status={t.sla_status} deadline={t.sla_deadline} />
            </div>
            <div className="font-semibold mt-1 truncate">{t.sujet}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{t.user?.name ?? "Utilisateur supprimé"}</span>
              {cat && <span>· {cat.name}</span>}
              <span>· {formatRelative(t.created_at)}</span>
              {(t.reply_count ?? 0) > 0 && <span>· {t.reply_count} réponse(s)</span>}
              {t.assignee && <span>· Assigné à {t.assignee.name}</span>}
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
