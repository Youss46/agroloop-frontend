import { useRoute, Link } from "wouter";
import { useGetUserProfile } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/star-rating";
import {
  MapPin,
  Calendar,
  Package,
  TrendingUp,
  MessageSquareQuote,
  ArrowLeft,
  Pencil,
  Scale,
  Sprout,
  Tag,
} from "lucide-react";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-CI").format(n);
}

export default function Profile() {
  const [, params] = useRoute("/profil/:userId");
  const userId = Number(params?.userId);
  const { user: me } = useAuth();
  const isOwnProfile = !!me && me.id === userId;

  const { data: profile, isLoading, error } = useGetUserProfile(userId, {
    query: { enabled: Number.isFinite(userId) } as any,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-2xl text-center">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-xl font-bold mb-2">Profil introuvable</h1>
            <p className="text-muted-foreground mb-6">
              Cet utilisateur n'existe pas ou a été supprimé.
            </p>
            <Link href="/marketplace">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour au marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProducteur = profile.role === "producteur";
  const roleBadgeClass =
    profile.role === "producteur"
      ? "bg-green-100 text-green-700 border-green-200"
      : profile.role === "transformateur"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-amber-100 text-amber-700 border-amber-200";
  const roleLabel =
    profile.role === "producteur"
      ? "Producteur"
      : profile.role === "transformateur"
      ? "Transformateur"
      : "Admin";

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl space-y-6">
      {/* Header */}
      <Card className="border-none shadow-sm ring-1 ring-border/50" data-testid="card-profile-header">
        <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start">
          <Avatar className="h-24 w-24 text-2xl shrink-0">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.name} /> : null}
            <AvatarFallback className="bg-[#16a34a] text-white font-bold text-xl">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-profile-name">
                {profile.name}
              </h1>
              <Badge variant="outline" className={`${roleBadgeClass} border capitalize`}>
                {roleLabel}
              </Badge>
              {isOwnProfile && (
                <Link href="/profil/modifier">
                  <Button size="sm" variant="outline" className="gap-2 ml-auto" data-testid="btn-edit-profile">
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profile.region && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {profile.region}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Membre depuis{" "}
                {new Date(profile.createdAt).toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="mt-4">
              <StarRating
                value={profile.ratingAvg}
                count={profile.ratingCount}
                size={20}
                showCount
                showAvg
                emptyLabel="Aucun avis pour le moment"
              />
              {profile.ratingCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Basé sur {profile.ratingCount} avis
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="flex gap-3 overflow-x-auto md:grid md:grid-cols-4 md:overflow-visible pb-2 -mx-1 px-1">
        <StatCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Transactions" value={formatNumber(profile.totalTransactions)} testId="stat-tx" />
        <StatCard icon={<Scale className="h-4 w-4 text-primary" />} label="Kg échangés" value={`${formatNumber(profile.totalKgTraded)} kg`} testId="stat-kg" />
        {isProducteur && (
          <>
            <StatCard icon={<Package className="h-4 w-4 text-primary" />} label="Offres publiées" value={formatNumber(profile.totalOffresPubliees)} testId="stat-offres" />
            <StatCard icon={<Sprout className="h-4 w-4 text-primary" />} label="Types de résidus" value={formatNumber(profile.totalResidusTypes)} testId="stat-types" />
          </>
        )}
      </div>

      {/* Bio */}
      {profile.bio && (
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">À propos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line" data-testid="text-profile-bio">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Filières */}
      {profile.filieres.length > 0 && (
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Filières travaillées
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.filieres.map((f) => (
              <Badge
                key={f}
                variant="outline"
                className="bg-green-50 text-green-700 border-green-300"
                data-testid={`chip-filiere-${f}`}
              >
                {f}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active offers (producteur) */}
      {isProducteur && profile.activeOffres.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold tracking-tight">
              Offres disponibles ({profile.activeOffres.length})
            </h2>
            <Link
              href={`/marketplace?seller=${profile.id}`}
              className="text-sm text-primary hover:underline"
              data-testid="link-all-offers"
            >
              Voir toutes ses offres
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {profile.activeOffres.map((o) => (
              <Card key={o.id} className="border-none shadow-sm ring-1 ring-border/50" data-testid={`card-active-offre-${o.id}`}>
                <CardContent className="p-4">
                  <div className="font-semibold mb-1">{o.typeResidu}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatNumber(o.quantityKg)} kg · {formatNumber(o.priceFcfa)} FCFA/kg
                  </div>
                  {o.region && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {o.region}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-primary" />
          Avis reçus ({profile.ratingCount})
        </h2>
        {profile.ratings.length === 0 ? (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <MessageSquareQuote className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Cet utilisateur n'a pas encore reçu d'avis</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {profile.ratings.slice(0, 5).map((r) => (
              <Card key={r.id} className="border-none shadow-sm ring-1 ring-border/50" data-testid={`card-review-${r.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-muted text-foreground text-sm">
                          {initials(r.reviewerName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={`/profil/${r.reviewerId}`}
                          className="font-medium truncate hover:text-primary"
                          data-testid={`link-reviewer-${r.reviewerId}`}
                        >
                          {r.reviewerName}
                        </Link>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.offerTitle} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>
                    <StarRating
                      value={r.stars}
                      count={1}
                      showCount={false}
                      showAvg={false}
                      size={14}
                    />
                  </div>
                  {r.comment && (
                    <p className="text-sm text-foreground mt-2 italic text-muted-foreground">
                      "{r.comment}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, testId }: { icon: React.ReactNode; label: string; value: string; testId: string }) {
  return (
    <Card className="border-none shadow-sm ring-1 ring-border/50 min-w-[160px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`text-${testId}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
