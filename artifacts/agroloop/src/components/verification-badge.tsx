import { ShieldCheck, BadgeCheck } from "lucide-react";

type Props = {
  status?: string | null;
  level?: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

export function VerificationBadge({ status, level, size = "md", showLabel = false }: Props) {
  const lvl = Number(level ?? 0);
  if (lvl < 1) return null;
  const isPro = lvl >= 2;
  const sizes = {
    sm: { icon: 14, padX: "px-1.5", padY: "py-0.5", text: "text-xs" },
    md: { icon: 16, padX: "px-2", padY: "py-0.5", text: "text-xs" },
    lg: { icon: 18, padX: "px-2.5", padY: "py-1", text: "text-sm" },
  }[size];
  const color = isPro
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : "bg-blue-50 text-blue-800 border-blue-300";
  const Icon = isPro ? BadgeCheck : ShieldCheck;
  const label = isPro ? "Pro vérifié" : "Identité vérifiée";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${color} ${sizes.padX} ${sizes.padY} ${sizes.text} font-medium`}
      title={label}
      data-testid={`verification-badge-${isPro ? "pro" : "identity"}`}
    >
      <Icon size={sizes.icon} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
