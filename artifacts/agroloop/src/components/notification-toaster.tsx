import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth-provider";
import { connectSocket } from "@/lib/socket";
import { NOTIF_TYPE_META, type AppNotification } from "@/lib/notifications-api";
import { ToastAction } from "@/components/ui/toast";

export function NotificationToaster() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const s = connectSocket();
    const handler = (n: AppNotification) => {
      qc.invalidateQueries({ queryKey: ["notif-unread-count"] });
      qc.invalidateQueries({ queryKey: ["notif-dropdown-list"] });
      qc.invalidateQueries({ queryKey: ["notif-page"] });
      // Suppress toast if user is already on the linked page
      if (n.link && location === n.link.split("?")[0]) return;
      const meta = NOTIF_TYPE_META[n.type];
      toast({
        title: `${meta.emoji}  ${n.title}`,
        description: n.body,
        duration: 4000,
        action: n.link ? (
          <ToastAction
            altText="Voir"
            onClick={() => { if (n.link) setLocation(n.link); }}
          >
            Voir
          </ToastAction>
        ) : undefined,
      });
    };
    s.on("new_notification", handler);
    return () => { s.off("new_notification", handler); };
  }, [token, toast, location, setLocation, qc]);

  return null;
}
