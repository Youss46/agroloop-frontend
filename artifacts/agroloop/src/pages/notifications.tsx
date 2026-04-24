import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, Trash2 } from "lucide-react";
import {
  fetchNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteAllNotifications,
  NOTIF_TYPE_META,
  relativeTime,
  type AppNotification,
} from "@/lib/notifications-api";
import { useToast } from "@/hooks/use-toast";

type Filter = "all" | "unread" | "messages" | "offres" | "transactions";

const FILTER_TYPES: Record<Filter, string | undefined> = {
  all: undefined,
  unread: undefined,
  messages: "nouveau_message",
  offres: "offre_correspondante",
  transactions: undefined, // filtered client-side to include both confirmee + annulee
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const queryKey = ["notif-page", filter, page];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotifications({
      page,
      limit: 20,
      unread: filter === "unread" || undefined,
      type: FILTER_TYPES[filter],
    }),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["notif-page"] });
    qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
    qc.invalidateQueries({ queryKey: ["notif-dropdown-list"] });
  };

  const readMut = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: invalidateAll,
  });
  const allReadMut = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => { invalidateAll(); toast({ title: "Toutes les notifications marquées comme lues" }); },
  });
  const delMut = useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: invalidateAll,
  });
  const delAllMut = useMutation({
    mutationFn: () => deleteAllNotifications(),
    onSuccess: () => { invalidateAll(); toast({ title: "Notifications supprimées" }); },
  });

  const rawItems = data?.items ?? [];
  const items = filter === "transactions"
    ? rawItems.filter((n) => n.type === "transaction_confirmee" || n.type === "transaction_annulee")
    : rawItems;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  function clickItem(n: AppNotification) {
    if (!n.readAt) readMut.mutate(n.id);
    if (n.link) setLocation(n.link);
  }

  return (
    <div className="container py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => allReadMut.mutate()}
            disabled={allReadMut.isPending}
            data-testid="button-mark-all-read-page"
          >
            <Check className="h-4 w-4 mr-1" /> Tout marquer comme lu
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (confirm("Supprimer toutes les notifications ?")) delAllMut.mutate(); }}
            disabled={delAllMut.isPending}
            data-testid="button-delete-all"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Tout effacer
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => { setFilter(v as Filter); setPage(1); }} className="mb-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Toutes</TabsTrigger>
          <TabsTrigger value="unread" data-testid="tab-unread">Non lues</TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">Messages</TabsTrigger>
          <TabsTrigger value="offres" data-testid="tab-offres">Offres</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-30" />
              <span>Aucune notification</span>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const meta = NOTIF_TYPE_META[n.type];
                const unread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    className={`flex items-start gap-4 px-5 py-4 ${unread ? "bg-green-50" : ""}`}
                    data-testid={`notif-row-${n.id}`}
                  >
                    <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${meta.bg} ${meta.color}`}>
                      <span className="text-lg">{meta.emoji}</span>
                    </div>
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => clickItem(n)}>
                      <div className={`text-sm ${unread ? "font-semibold" : ""}`}>{n.title}</div>
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>
                      <div className="text-xs text-muted-foreground mt-2">{relativeTime(n.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {unread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => readMut.mutate(n.id)}
                          aria-label="Marquer comme lu"
                          data-testid={`button-read-${n.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => delMut.mutate(n.id)}
                        aria-label="Supprimer"
                        data-testid={`button-delete-${n.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
