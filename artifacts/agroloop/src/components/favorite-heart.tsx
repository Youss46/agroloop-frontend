import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { favoritesApi } from "@/lib/favorites-api";
import { cn } from "@/lib/utils";

type Props = {
  type: "offre" | "producteur";
  id: number;
  initialFavorited?: boolean;
  variant?: "icon" | "full"; // icon = card overlay, full = button with label
  size?: "sm" | "md" | "lg";
  className?: string;
  testId?: string;
};

export function FavoriteHeart({ type, id, initialFavorited, variant = "icon", size = "md", className, testId }: Props) {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [favorited, setFavorited] = useState<boolean>(!!initialFavorited);
  const [pending, setPending] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Only transformateurs can favorite (per spec).
  const canFavorite = user?.role === "transformateur" && !!token;

  useEffect(() => {
    if (!canFavorite) return;
    if (initialFavorited !== undefined) return;
    let cancelled = false;
    favoritesApi.check(type, id).then((r: { favorited: boolean }) => {
      if (!cancelled) setFavorited(r.favorited);
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [canFavorite, type, id, initialFavorited]);

  if (!canFavorite) return null;

  const toggle = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (pending) return;
    const next = !favorited;
    setFavorited(next);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    setPending(true);
    try {
      if (next) {
        await favoritesApi.add(
          type === "offre" ? { type: "offre", offre_id: id } : { type: "producteur", producteur_id: id },
        );
        toast({ description: "❤️ Ajouté aux favoris" });
      } else {
        await favoritesApi.remove(type, id);
        toast({ description: "💔 Retiré des favoris" });
      }
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
    } catch (err: any) {
      setFavorited(!next); // revert
      toast({ description: err?.message ?? "Erreur", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  const sizeMap = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-6 w-6" } as const;
  const heartCls = cn(
    sizeMap[size],
    "transition-all duration-200",
    favorited ? "fill-[#ef4444] text-[#ef4444]" : "fill-none text-[#d1d5db]",
    animating && "scale-125",
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
        title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-white/90 hover:bg-white shadow-sm w-8 h-8 backdrop-blur-sm",
          className,
        )}
        data-testid={testId ?? `button-favorite-${type}-${id}`}
      >
        <Heart className={heartCls} />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={favorited ? "default" : "outline"}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "gap-2",
        favorited ? "bg-[#ef4444] hover:bg-[#dc2626] text-white" : "",
        className,
      )}
      data-testid={testId ?? `button-favorite-${type}-${id}`}
    >
      <Heart className={heartCls} />
      {type === "producteur"
        ? favorited ? "Retiré ce producteur" : "❤️ Suivre ce producteur"
        : favorited ? "💔 Retirer des favoris" : "❤️ Sauvegarder"}
    </Button>
  );
}
