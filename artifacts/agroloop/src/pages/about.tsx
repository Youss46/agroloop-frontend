import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Recycle, Users, Target, Globe, ShieldCheck, ArrowRight } from "lucide-react";

const team = [
  {
    initials: "YD",
    name: "Youssouf Diabaté",
    role: "Fondateur & CEO",
    description: "Expert en économie circulaire agricole avec 10 ans d'expérience dans le secteur agro-industriel ivoirien.",
    bg: "bg-primary/10",
    color: "text-primary",
  },
  {
    initials: "AK",
    name: "Adjoua Koné",
    role: "Directrice Opérations",
    description: "Spécialiste en logistique agricole et en mise en relation entre producteurs et transformateurs.",
    bg: "bg-emerald-100",
    color: "text-emerald-700",
  },
  {
    initials: "MS",
    name: "Moussa Sanogo",
    role: "Directeur Technique",
    description: "Ingénieur full-stack passionné par l'impact social des technologies numériques en Afrique de l'Ouest.",
    bg: "bg-blue-100",
    color: "text-blue-700",
  },
];

const values = [
  {
    icon: Leaf,
    title: "Durabilité",
    description: "Nous croyons que la valorisation des résidus agricoles est au cœur d'une agriculture ivoirienne durable et rentable.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Users,
    title: "Communauté",
    description: "Nous mettons en relation producteurs et transformateurs pour créer un écosystème solidaire et prospère.",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: ShieldCheck,
    title: "Confiance",
    description: "Chaque transaction est sécurisée et chaque acteur vérifié pour garantir des échanges fiables.",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    icon: Globe,
    title: "Impact",
    description: "Notre mission : réduire le gaspillage agricole tout en créant de nouvelles sources de revenus pour les agriculteurs.",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

const milestones = [
  { year: "2022", event: "Création d'AgroLoopCI à Abidjan — première étude terrain sur les résidus de cacao et d'anacarde." },
  { year: "2023", event: "Lancement de la version bêta avec 15 producteurs pilotes dans les régions de Bouaké et Korhogo." },
  { year: "2024", event: "Plus de 50 producteurs et 20 transformateurs actifs. Première transaction sécurisée en ligne." },
  { year: "2025", event: "Extension à toutes les régions de Côte d'Ivoire. Lancement de la fonctionnalité Carte géolocalisée." },
  { year: "2026", event: "Lancement de l'application mobile PWA. Plus de 500 tonnes de résidus valorisées à ce jour." },
];

export default function About() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary/5 py-20 lg:py-28">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              🌿 Notre histoire
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-foreground">
              À propos d'<span className="text-primary">AgroLoopCI</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              AgroLoopCI est la première marketplace B2B dédiée à la valorisation des résidus agro-industriels
              en Côte d'Ivoire. Notre plateforme connecte producteurs agricoles et transformateurs pour créer
              une économie circulaire durable et profitable pour tous.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-foreground">Notre Mission</h2>
              </div>
              <p className="text-muted-foreground text-lg leading-relaxed">
                En Côte d'Ivoire, des millions de tonnes de résidus agricoles — coques d'anacarde, cabosses
                de cacao, tiges de plantain, balles de riz — sont brûlées ou abandonnées chaque année,
                représentant une perte économique et environnementale considérable.
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed">
                AgroLoopCI transforme ces déchets en ressources. Notre plateforme numérique permet aux
                producteurs de monétiser leurs résidus et aux transformateurs de trouver des matières
                premières locales à prix compétitif — tout en réduisant l'empreinte carbone du secteur agricole.
              </p>
              <div className="grid grid-cols-2 gap-4 pt-2">
                {[
                  { value: "500+", label: "Tonnes valorisées" },
                  { value: "70+", label: "Acteurs partenaires" },
                  { value: "10", label: "Régions couvertes" },
                  { value: "48h", label: "Délai moyen de vente" },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-center">
                    <div className="text-2xl font-extrabold text-primary">{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {["Cabosses de cacao", "Coques d'anacarde", "Tiges de plantain", "Balles de riz", "Bagasse de canne à sucre", "Tourteaux de coton"].map((filiere, i) => (
                <div
                  key={filiere}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-card shadow-sm"
                >
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Recycle className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{filiere}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    Filière #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Valeurs */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Nos Valeurs</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Les principes qui guident chacune de nos décisions et l'évolution de la plateforme.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <Card key={v.title} className="text-center border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-8 pb-6 space-y-3">
                  <div className={`mx-auto p-4 ${v.bg} rounded-full w-fit`}>
                    <v.icon className={`h-7 w-7 ${v.color}`} />
                  </div>
                  <h3 className="font-bold text-lg text-foreground">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-background">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Notre Parcours</h2>
            <p className="mt-3 text-muted-foreground">
              De l'idée à la plateforme — les étapes clés de notre aventure.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-primary/20 md:left-1/2" />
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <div
                  key={m.year}
                  className={`relative flex gap-6 items-start ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm z-10 shadow-md md:mx-auto">
                    {m.year.slice(2)}
                  </div>
                  <div className={`flex-1 p-4 rounded-xl border bg-card shadow-sm ${i % 2 === 0 ? "md:mr-8" : "md:ml-8"}`}>
                    <div className="text-xs font-bold text-primary mb-1">{m.year}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Équipe */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">L'Équipe</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Une équipe passionnée par l'agriculture durable et l'innovation numérique en Afrique.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {team.map((member) => (
              <Card key={member.name} className="text-center border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-8 pb-6 space-y-3">
                  <div className={`mx-auto w-16 h-16 rounded-full ${member.bg} flex items-center justify-center`}>
                    <span className={`text-xl font-extrabold ${member.color}`}>{member.initials}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{member.name}</h3>
                    <p className="text-xs text-primary font-medium mt-0.5">{member.role}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-white">
        <div className="container px-4 md:px-6 text-center space-y-6">
          <h2 className="text-3xl font-bold">Rejoignez le mouvement</h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto text-lg">
            Ensemble, transformons les résidus agricoles en opportunités économiques pour la Côte d'Ivoire.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="gap-2 h-12 text-base">
                <Leaf className="h-5 w-5" />
                Commencer gratuitement
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button size="lg" variant="outline" className="gap-2 h-12 text-base border-white text-white hover:bg-white/10">
                Explorer la marketplace
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
