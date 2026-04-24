import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { onlineStatusApi, computeStatusLabel, isOnlineFromLastSeen, type UserStatus } from "@/lib/online-status";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";

const SIZE_PX = { sm: 6, md: 8, lg: 10 } as const;

type DotProps = {
  isOnline: boolean;
  size?: keyof typeof SIZE_PX;
  className?: string;
};

export function OnlineDot({ isOnline, size = "md", className }: DotProps) {
  const px = SIZE_PX[size];
  return (
    <span
      className={cn(
        "inline-block rounded-full ring-2 ring-white",
        isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400",
        className,
      )}
      style={{ width: px, height: px }}
      aria-label={isOnline ? "En ligne" : "Hors ligne"}
      data-testid={`dot-online-${isOnline ? "yes" : "no"}`}
    />
  );
}

type StatusProps = {
  userId: number;
  // Optional initial values to avoid an extra fetch (e.g. from list endpoints).
  lastSeen?: string | null;
  showOnlineStatus?: boolean | null;
  showLabel?: boolean;
  size?: keyof typeof SIZE_PX;
  className?: string;
};

export function OnlineStatus({ userId, lastSeen, showOnlineStatus, showLabel = true, size = "md", className }: StatusProps) {
  const { token } = useAuth();
  const hasInitial = lastSeen !== undefined && showOnlineStatus !== undefined;

  const { data: fetched } = useQuery<UserStatus>({
    queryKey: ["user-status", userId],
    queryFn: () => onlineStatusApi.get(userId),
    enabled: !!token && !hasInitial,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Real-time socket updates.
  const [socketLastSeen, setSocketLastSeen] = useState<string | null>(null);
  const [socketOnline, setSocketOnline] = useState<boolean | null>(null);
  useEffect(() => {
    if (!token) return;
    const s = getSocket();
    if (!s) return;
    const onUp = (p: { userId: number }) => { if (p.userId === userId) { setSocketOnline(true); setSocketLastSeen(new Date().toISOString()); } };
    const onDown = (p: { userId: number; last_seen?: string }) => { if (p.userId === userId) { setSocketOnline(false); if (p.last_seen) setSocketLastSeen(p.last_seen); } };
    s.on("user_online", onUp);
    s.on("user_offline", onDown);
    return () => { s.off("user_online", onUp); s.off("user_offline", onDown); };
  }, [token, userId]);

  let isOnline: boolean;
  let label: string;
  let visible: boolean = true;
  void tick; // recompute on tick

  if (socketOnline !== null) {
    isOnline = socketOnline;
    label = computeStatusLabel(socketLastSeen, socketOnline);
  } else if (hasInitial) {
    if (showOnlineStatus === false) { visible = false; isOnline = false; label = "Hors ligne"; }
    else { isOnline = isOnlineFromLastSeen(lastSeen, showOnlineStatus); label = computeStatusLabel(lastSeen ?? null, isOnline); }
  } else if (fetched) {
    isOnline = fetched.is_online;
    label = fetched.status_label;
  } else {
    isOnline = false;
    label = "";
  }

  if (!visible) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)} data-testid={`online-status-${userId}`}>
      <OnlineDot isOnline={isOnline} size={size} />
      {showLabel && <span>{label || "—"}</span>}
    </span>
  );
}
