import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchNotifications,
  fetchUnreadCount,
  markRead,
  markAllRead,
  NOTIF_TYPE_META,
  relativeTime,
  type AppNotification,
} from "@/lib/notifications-api";
import { useAuth } from "@/components/auth-provider";

const UNREAD_KEY = ["notif-unread-count"];
const LIST_KEY = ["notif-dropdown-list"];

export function NotificationBell() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const prevUnread = useRef<number | null>(null);

  const { data: unread } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: fetchUnreadCount,
    enabled: !!token,
    refetchInterval: 60_000,
  });

  const { data: list } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => fetchNotifications({ limit: 10 }),
    enabled: !!token && open,
  });

  // Trigger shake when unread count goes up (driven by NotificationToaster's socket listener).
  // No socket subscription here — keeps a single global listener and avoids dupes when
  // both desktop and mobile bells are mounted simultaneously.
  useEffect(() => {
    if (typeof unread !== "number") return;
    if (prevUnread.current !== null && unread > prevUnread.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 700);
      prevUnread.current = unread;
      return () => clearTimeout(t);
    }
    prevUnread.current = unread;
  }, [unread]);

  const readMutation = useMutation({
    mutationFn: (id: number) => markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  const allReadMutation = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: UNREAD_KEY });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  if (!token) return null;

  const count = unread ?? 0;
  const items = list?.items ?? [];

  function onClickItem(n: AppNotification) {
    if (!n.readAt) readMutation.mutate(n.id);
    setOpen(false);
    if (n.link) setLocation(n.link);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          data-testid="button-notification-bell"
        >
          <Bell className={`h-5 w-5 ${shake ? "animate-bell-shake" : ""}`} />
          {count > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
              data-testid="badge-notif-unread"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 max-w-[95vw]"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold">Notifications</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline disabled:opacity-50"
            disabled={count === 0 || allReadMutation.isPending}
            onClick={() => allReadMutation.mutate()}
            data-testid="button-mark-all-read"
          >
            Tout marquer comme lu
          </button>
        </div>
        <ScrollArea className="max-h-[480px]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-30" />
              <span className="text-sm">Aucune notification</span>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const meta = NOTIF_TYPE_META[n.type];
                const unreadItem = !n.readAt;
                return (
                  <li
                    key={n.id}
                    onClick={() => onClickItem(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${unreadItem ? "bg-green-50" : ""}`}
                    data-testid={`notif-item-${n.id}`}
                  >
                    <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${meta.bg} ${meta.color}`}>
                      <span className="text-base">{meta.emoji}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${unreadItem ? "font-semibold" : ""}`}>{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{relativeTime(n.createdAt)}</div>
                    </div>
                    {unreadItem && <span className="shrink-0 mt-2 h-2 w-2 rounded-full bg-blue-500" />}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2 text-center">
          <Link
            href="/notifications"
            className="text-sm text-primary hover:underline"
            onClick={() => setOpen(false)}
            data-testid="link-see-all-notifications"
          >
            Voir tout
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
