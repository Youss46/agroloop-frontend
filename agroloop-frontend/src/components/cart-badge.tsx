import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { cartApi } from "@/lib/orders-api";
import { useAuth } from "@/components/auth-provider";

export function CartBadge({ mobile = false }: { mobile?: boolean }) {
  const { user, token } = useAuth();
  const enabled = !!token && user?.role === "transformateur";

  const { data } = useQuery({
    queryKey: ["cart-count"],
    queryFn: () => cartApi.count(),
    enabled,
    refetchInterval: 60000,
  });

  if (!enabled) return null;
  const count = data?.count ?? 0;

  return (
    <Link
      href="/panier"
      className={`text-sm font-medium transition-colors hover:text-primary text-muted-foreground relative inline-flex items-center gap-2`}
      data-testid="link-cart"
    >
      <div className="relative">
        <ShoppingCart className="h-4 w-4" />
        {count > 0 && (
          <span
            className="absolute -top-2 -right-2 bg-emerald-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
            data-testid="badge-cart-count"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>
      {mobile && <span>Panier</span>}
    </Link>
  );
}
