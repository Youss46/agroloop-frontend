import { cn } from "@/lib/utils";

export const ROLE_META: Record<
  string,
  { label: string; emoji: string; bg: string; text: string; border: string }
> = {
  super_admin: { label: "Super Admin", emoji: "👑", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  admin:       { label: "Admin",       emoji: "👑", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  moderateur:  { label: "Modérateur",  emoji: "🛡", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  support:     { label: "Support",     emoji: "🎧", bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
  finance:     { label: "Finance",     emoji: "💰", bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200" },
  commercial:  { label: "Commercial",  emoji: "📈", bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
};

export function RoleBadge({ role, className, hideEmoji = false }: { role: string; className?: string; hideEmoji?: boolean }) {
  const meta = ROLE_META[role] ?? { label: role, emoji: "•", bg: "bg-muted", text: "text-foreground", border: "border-border" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
        meta.bg, meta.text, meta.border, className,
      )}
      data-testid={`role-badge-${role}`}
    >
      {!hideEmoji && <span aria-hidden>{meta.emoji}</span>}
      <span>{meta.label}</span>
    </span>
  );
}
