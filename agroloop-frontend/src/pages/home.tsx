import { useGetStats } from "@/api-client";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Leaf, Recycle, Users, ArrowRight, ChevronDown, Star, MapPin, Package, TrendingUp, LayoutDashboard, ShoppingCart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@assets/Screenshot_20260421-011356_1776734073256.png";
import { useSEO } from "@/hooks/useSEO";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";

const faqs = [
  {
    question: "Qu'est-ce que l'économie circulaire agricole ?",
    answer: "L'économie circulaire agricole consiste à valoriser les résidus et sous-produits agricoles comme les cabosses de cacao, coques d'anacarde et tiges de plantain au lieu de les brûler ou les abandonner.",
  },
  {
    question: "Comment fonctionne AgroLoopCI ?",
    answer: "AgroLoopCI connecte les producteurs agricoles aux transformateurs via une marketplace géolocalisée. Les producteurs publient leurs résidus disponibles et les transformateurs les achètent directement.",
  },
  {
    question: "Quels types de résidus agricoles sont disponibles ?",
    answer: "Cabosses de cacao, coques d'anacarde, tiges de plantain, balles de riz et bien d'autres résidus agro-industriels en Côte d'Ivoire.",
  },
  {
    question: "AgroLoopCI est-il gratuit ?",
    answer: "L'inscription est gratuite. AgroLoopCI prend une petite commission uniquement sur les transactions réalisées.",
  },
  {
    question: "Dans quelles régions opère AgroLoopCI ?",
    answer: "AgroLoopCI opère dans toutes les régions de Côte d'Ivoire : Abidjan, San Pedro, Abengourou, Bouaké, Korhogo, Daloa, Man et Yamoussoukro.",
  },
];

const testimonials = [
  {
    name: "Kouamé Arsène",
    role: "Producteur de cacao",
    region: "Bouaké",
    avatar: "KA",
    rating: 5,
    text: "Avant AgroLoopCI, je brûlais mes cabosses vides après chaque récolte. Maintenant je les vends à 25 000 FCFA la tonne. En 3 mois j'ai généré plus de 150 000 FCFA de revenus supplémentaires. C'est une vraie révolution pour nous les producteurs.",
  },
  {
    name: "Adjoua Micheline",
    role: "Transformatrice — bioénergie",
    region: "Abidjan",
    avatar: "AM",
    rating: 5,
    text: "Je cherchais des coques d'anacarde pour ma chaudière de façon régulière. Grâce à la plateforme, j'ai trouvé 4 fournisseurs stables dans la région de Bouaflé. Les échanges via WhatsApp intégré sont très pratiques et la transaction est sécurisée.",
  },
  {
    name: "N'Goran Sylvain",
    role: "Producteur d'anacarde",
    region: "Korhogo",
    avatar: "NS",
    rating: 5,
    text: "La carte interactive m'a permis de trouver un transformateur à seulement 30 km de mon exploitation. Le transport est maintenant rentable. J'ai vendu mes premières coques en moins de 48h après mon inscription. Je recommande vivement.",
  },
];

const chiffres = [
  { value: 500, suffix: "+", label: "Tonnes de résidus valorisées", icon: Package, color: "text-primary", bg: "bg-primary/10" },
  { value: 50, suffix: "+", label: "Producteurs actifs", icon: Leaf, color: "text-emerald-600", bg: "bg-emerald-50" },
  { value: 20, suffix: "+", label: "Transformateurs partenaires", icon: Recycle, color: "text-blue-600", bg: "bg-blue-50" },
  { value: 10, suffix: "", label: "Régions couvertes", icon: MapPin, color: "text-orange-600", bg: "bg-orange-50" },
];

function useCountUp(target: number, duration = 1800, triggered = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!triggered) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, triggered]);
  return count;
}

function AnimatedCounter({ value, suffix, label, icon: Icon, color, bg }: typeof chiffres[0]) {
  const ref = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);
  const count = useCountUp(value, 1600, triggered);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTriggered(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col items-center text-center p-6">
      <div className={`p-4 ${bg} rounded-full mb-4`}>
        <Icon className={`h-7 w-7 ${color}`} />
      </div>
      <div className={`text-4xl font-extrabold ${color} tabular-nums`}>
        {count}{suffix}
      </div>
      <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider max-w-[140px]">
        {label}
      </p>
    </div>
  );
}

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 hover:text-primary transition-colors"
        aria-expanded={open}
        data-testid={`faq-item-${index}`}
      >
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-5 text-muted-foreground leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  useSEO({
    title: "Valorisation résidus agro-industriels — Marketplace agricole UEMOA",
    description: "AgroLoopCI est la première plateforme numérique d'économie circulaire agricole en Côte d'Ivoire. Achetez et vendez des résidus agro-industriels : coques d'anacarde, cabosses de cacao, tiges de plantain. Disponible à Abidjan et dans toute la zone UEMOA.",
    url: "/",
  });
  const { data: stats, isLoading } = useGetStats();
  const { user } = useAuth();
  const dashboardLink = user?.role === "producteur" ? "/dashboard/producteur" : "/dashboard/transformateur";

  const formatNumber = (num?: number) => {
    if (num === undefined) return "0";
    return new Intl.NumberFormat("fr-CI").format(num);
  };

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-24 lg:py-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=2070&auto=format&fit=crop')] opacity-5 bg-cover bg-center mix-blend-multiply" />
        <div className="container relative z-10 px-4 md:px-6">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              🌿 Zéro gaspillage · Impact maximum
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
              Donnez de la valeur à vos <span className="text-primary">résidus agricoles</span>
            </h1>
            
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              La première marketplace B2B dédiée à la valorisation des résidus agricoles en Côte d'Ivoire.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-8">
              {user ? (
                <>
                  <Link href="/marketplace">
                    <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12" data-testid="button-home-marketplace">
                      <ShoppingCart className="h-5 w-5" />
                      Accéder au Marketplace
                    </Button>
                  </Link>
                  <Link href={dashboardLink}>
                    <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base h-12 border-primary text-primary hover:bg-primary/5" data-testid="button-home-dashboard">
                      <LayoutDashboard className="h-5 w-5" />
                      Mon tableau de bord
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register">
                    <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12" data-testid="button-home-register-producteur">
                      <Leaf className="h-5 w-5" />
                      Je suis Producteur
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-base h-12 border-primary text-primary hover:bg-primary/5" data-testid="button-home-register-transformateur">
                      <Recycle className="h-5 w-5" />
                      Je suis Transformateur
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-background">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Notre Impact</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Ensemble, nous créons une chaîne de valeur plus durable et rentable pour l'agriculture ivoirienne.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-none shadow-md bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                  <Recycle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : `${formatNumber(stats?.totalKgValorise)} kg`}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Résidus agricoles valorisés</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-accent/10 rounded-full text-accent">
                  <Leaf className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : `${formatNumber(stats?.co2Evite)} kg`}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">kg de CO₂ évités</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-card sm:col-span-2 lg:col-span-1">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-blue-500/10 rounded-full text-blue-500">
                  <Users className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold text-foreground">
                    {isLoading ? <Skeleton className="h-10 w-24 mx-auto" /> : formatNumber(stats?.totalUtilisateurs)}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Producteurs connectés</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                  Comment ça marche ?
                </h2>
                <p className="text-lg text-muted-foreground">
                  AgroLoopCI simplifie la vente et l'achat de déchets agricoles à travers une plateforme sécurisée et intuitive.
                </p>
              </div>
              
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Publiez vos résidus agricoles</h3>
                    <p className="mt-2 text-muted-foreground">Les producteurs publient leurs résidus disponibles. Les transformateurs recherchent la matière première dont ils ont besoin.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Connectez-vous avec des acheteurs</h3>
                    <p className="mt-2 text-muted-foreground">Utilisez notre intégration WhatsApp pour négocier les détails, les prix et la logistique directement avec le partenaire.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Valorisez et générez des revenus</h3>
                    <p className="mt-2 text-muted-foreground">Transformez des déchets en revenus additionnels ou en énergie verte, contribuant à une économie circulaire.</p>
                  </div>
                </li>
              </ul>
              
              <Link href="/marketplace">
                <Button variant="outline" className="gap-2 mt-4" data-testid="button-home-explore">
                  Explorer la Marketplace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            <div className="relative mx-auto w-full max-w-[500px] aspect-square rounded-2xl overflow-hidden border bg-background shadow-xl">
              <img src={heroImage} alt="Cabosses de cacao sur l'arbre" className="absolute inset-0 w-full h-full object-cover" loading="eager" fetchPriority="high" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">Cabosses de cacao</span>
                    <span className="text-xs font-medium text-muted-foreground">Bouaké</span>
                  </div>
                  <div className="font-bold text-lg">5 000 kg</div>
                  <div className="text-sm text-muted-foreground">75 000 FCFA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nos filières — keyword-rich content section */}
      <section className="py-24 bg-background" aria-label="Filières de valorisation des résidus agro-industriels en Côte d'Ivoire">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Résidus agro-industriels disponibles en Côte d'Ivoire
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              AgroLoopCI est la plateforme agriculture numérique de référence en Côte d'Ivoire pour l'économie circulaire agricole.
              Découvrez les filières que nous couvrons, de la zone UEMOA à Abidjan en passant par les bassins de production.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Cacao */}
            <article className="rounded-2xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="text-4xl">🍫</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Cacao</h3>
                <p className="text-xs text-primary font-medium mt-0.5">Valorisation résidus cacao · Côte d'Ivoire</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                La Côte d'Ivoire est le premier producteur mondial de cacao. Cabosses vides, coques et mucilage représentent
                des millions de tonnes de résidus valorisables chaque année en bioénergie, compost et biogaz.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Cabosses de cacao</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Coques de cacao</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Mucilage de cacao</li>
              </ul>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                  Voir les offres <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </article>

            {/* Anacarde */}
            <article className="rounded-2xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="text-4xl">🥜</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Anacarde</h3>
                <p className="text-xs text-primary font-medium mt-0.5">Achat coques anacarde · Côte d'Ivoire</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Premier exportateur mondial d'anacarde brut, la Côte d'Ivoire génère d'importantes quantités de coques
                d'anacarde. Ces résidus sont très recherchés pour la production d'huile de CNSL, de charbon végétal et d'énergie thermique.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Coques d'anacarde (CNSL)</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Pellicules de noix</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Tiges et feuilles</li>
              </ul>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                  Voir les offres <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </article>

            {/* Plantain */}
            <article className="rounded-2xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="text-4xl">🍌</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Plantain</h3>
                <p className="text-xs text-primary font-medium mt-0.5">Résidus agro-industriels · Zone UEMOA</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Culture vivrière majeure en Côte d'Ivoire et dans toute la zone UEMOA, le plantain génère des tiges,
                régimes et feuilles transformables en fibres, paillis agricoles, emballages biodégradables et substrats de compostage.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Tiges de plantain</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Régimes vides</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Feuilles séchées</li>
              </ul>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                  Voir les offres <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </article>

            {/* Autres filières */}
            <article className="rounded-2xl border bg-card p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="text-4xl">🌾</div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Autres filières</h3>
                <p className="text-xs text-primary font-medium mt-0.5">Plateforme agriculture numérique CI</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                Au-delà du cacao et de l'anacarde, notre marketplace d'économie circulaire agricole couvre toutes
                les filières ivoiriennes : riz, hévéa, palmier à huile, café. Une plateforme agriculture numérique ouverte à toute la Côte d'Ivoire.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Balles et paille de riz</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Rafles de palmier</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />Pulpe de café</li>
              </ul>
              <Link href="/marketplace">
                <Button size="sm" variant="outline" className="w-full gap-1 text-xs">
                  Voir les offres <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </article>
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            Toutes ces filières sont accessibles depuis notre marketplace : Abidjan, San Pedro, Bouaké, Korhogo, Daloa, Man, Abengourou, Yamoussoukro et toutes les régions de Côte d'Ivoire.
          </p>
        </div>
      </section>

      {/* Nos chiffres — Animated counters */}
      <section className="py-20 bg-muted/30" aria-label="Nos chiffres clés">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-primary font-medium text-sm mb-3">
              <TrendingUp className="h-4 w-4" />
              En constante croissance
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Nos chiffres</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Des résultats concrets qui témoignent de l'impact d'AgroLoopCI sur l'économie circulaire agricole en Côte d'Ivoire.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/30 rounded-2xl overflow-hidden border">
            {chiffres.map((c) => (
              <AnimatedCounter key={c.label} {...c} />
            ))}
          </div>
        </div>
      </section>

      {/* Témoignages */}
      <section className="py-24 bg-muted/30" aria-label="Témoignages clients">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ce que disent nos membres</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Des producteurs et transformateurs qui ont transformé leur activité grâce à AgroLoopCI.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.name} className="border shadow-sm bg-card flex flex-col">
                <CardContent className="p-6 flex flex-col gap-4 flex-1">
                  <div className="flex gap-1">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-muted-foreground leading-relaxed flex-1 italic">
                    &ldquo;{t.text}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role} · {t.region}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-background" aria-label="Foire aux questions" itemScope itemType="https://schema.org/FAQPage">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions fréquentes</h2>
            <p className="mt-4 text-muted-foreground">
              Tout ce que vous devez savoir avant de commencer.
            </p>
          </div>
          <div className="rounded-2xl border bg-card shadow-sm px-6">
            {faqs.map((faq, i) => (
              <div key={i} itemScope itemProp="mainEntity" itemType="https://schema.org/Question">
                <meta itemProp="name" content={faq.question} />
                <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                  <meta itemProp="text" content={faq.answer} />
                </div>
                <FaqItem question={faq.question} answer={faq.answer} index={i} />
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-muted-foreground mb-4">Vous avez d'autres questions ?</p>
            <Link href="/register">
              <Button className="gap-2">
                Créer un compte gratuit <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
