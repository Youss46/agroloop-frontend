import { Link } from "wouter";
import { ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. Qui sommes-nous ?",
    content: `AgroLoopCI est une plateforme numérique de mise en relation B2B dédiée à la valorisation des résidus agro-industriels en Côte d'Ivoire. La société est domiciliée à Abidjan, Côte d'Ivoire. Pour toute question relative à vos données personnelles, vous pouvez nous contacter à l'adresse : privacy@agroloopci.ci`,
  },
  {
    title: "2. Données collectées",
    content: `Nous collectons les informations suivantes lors de votre utilisation de la plateforme :

• Données d'identité : nom, prénom, nom de l'entreprise
• Données de contact : adresse e-mail, numéro de téléphone, région d'activité
• Données professionnelles : type d'activité (producteur / transformateur), filières agricoles, offres publiées
• Données de transaction : historique des achats et ventes, devis émis et reçus
• Données techniques : adresse IP, type de navigateur, pages visitées, données de localisation (avec votre consentement)
• Communications : messages échangés via la messagerie intégrée`,
  },
  {
    title: "3. Finalités du traitement",
    content: `Vos données personnelles sont traitées pour les finalités suivantes :

• Création et gestion de votre compte utilisateur
• Mise en relation entre producteurs et transformateurs
• Traitement des commandes, devis et transactions
• Envoi de notifications liées à votre activité sur la plateforme
• Amélioration de nos services et personnalisation de votre expérience
• Respect de nos obligations légales et réglementaires
• Prévention des fraudes et sécurisation de la plateforme
• Communication marketing (avec votre consentement explicite)`,
  },
  {
    title: "4. Base légale du traitement",
    content: `Nous traitons vos données sur les bases légales suivantes :

• Exécution du contrat : pour vous fournir les services de la plateforme auxquels vous avez souscrit
• Consentement : pour les communications marketing et l'utilisation de cookies non essentiels
• Intérêt légitime : pour la prévention des fraudes et l'amélioration de nos services
• Obligation légale : pour satisfaire à nos obligations comptables et fiscales`,
  },
  {
    title: "5. Partage des données",
    content: `Vos données ne sont jamais vendues à des tiers. Nous pouvons partager vos informations avec :

• D'autres utilisateurs de la plateforme : uniquement les informations nécessaires à la mise en relation (nom d'entreprise, région, offres publiées)
• Nos prestataires techniques : hébergement (Vercel, Railway), base de données, messagerie — qui agissent comme sous-traitants et sont soumis à des obligations de confidentialité strictes
• Les autorités publiques : uniquement si la loi l'exige ou en cas de procédure judiciaire`,
  },
  {
    title: "6. Conservation des données",
    content: `Nous conservons vos données personnelles selon les durées suivantes :

• Données de compte actif : pendant toute la durée de votre inscription + 3 ans après suppression
• Données de transaction : 10 ans (obligation comptable et fiscale)
• Données de communication (messages) : 3 ans à compter de leur création
• Données de navigation et logs : 12 mois
• Données marketing : jusqu'au retrait de votre consentement`,
  },
  {
    title: "7. Vos droits",
    content: `Conformément à la législation applicable sur la protection des données personnelles, vous disposez des droits suivants :

• Droit d'accès : obtenir une copie de vos données personnelles
• Droit de rectification : corriger des données inexactes ou incomplètes
• Droit à l'effacement : demander la suppression de vos données dans les cas prévus par la loi
• Droit à la portabilité : recevoir vos données dans un format structuré et lisible
• Droit d'opposition : vous opposer au traitement de vos données à des fins de prospection
• Droit à la limitation : demander la suspension du traitement de vos données

Pour exercer ces droits, contactez-nous à : privacy@agroloopci.ci. Nous répondrons dans un délai de 30 jours.`,
  },
  {
    title: "8. Cookies",
    content: `AgroLoopCI utilise des cookies pour améliorer votre expérience :

• Cookies essentiels : nécessaires au fonctionnement de la plateforme (session, authentification) — ne peuvent pas être désactivés
• Cookies analytiques : nous aident à comprendre comment vous utilisez la plateforme (avec votre consentement)
• Cookies de préférences : mémorisent vos paramètres d'affichage (avec votre consentement)

Vous pouvez gérer vos préférences de cookies via le bandeau affiché lors de votre première visite ou dans vos Préférences de compte.`,
  },
  {
    title: "9. Sécurité des données",
    content: `Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, toute altération, divulgation ou destruction :

• Communications chiffrées via HTTPS / TLS
• Mots de passe stockés sous forme hachée (bcrypt)
• Accès aux données limité au personnel autorisé
• Surveillance continue des accès et des activités suspectes
• Sauvegardes régulières et chiffrées`,
  },
  {
    title: "10. Transferts internationaux",
    content: `Vos données sont principalement traitées et stockées en Europe ou en Côte d'Ivoire. Si des transferts vers d'autres pays s'avèrent nécessaires (prestataires techniques), nous nous assurons que des garanties appropriées sont en place (clauses contractuelles types ou niveau de protection équivalent).`,
  },
  {
    title: "11. Modifications de cette politique",
    content: `Nous pouvons mettre à jour cette politique de confidentialité pour refléter des changements dans nos pratiques ou dans la législation applicable. Toute modification significative vous sera notifiée par e-mail ou via un avis prominent sur la plateforme au moins 30 jours avant son entrée en vigueur. La date de dernière mise à jour est indiquée en bas de cette page.`,
  },
  {
    title: "12. Contact et réclamations",
    content: `Pour toute question relative à cette politique ou à la protection de vos données personnelles :

📧 E-mail : privacy@agroloopci.ci
📍 Adresse : AgroLoopCI, Abidjan, Côte d'Ivoire

Si vous estimez que le traitement de vos données ne respecte pas la réglementation en vigueur, vous avez le droit de déposer une réclamation auprès de l'autorité de contrôle compétente en Côte d'Ivoire (ARTCI) ou de l'autorité européenne compétente si applicable.`,
  },
];

export default function PolitiqueConfidentialite() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="bg-primary/5 py-16 border-b">
        <div className="container px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Politique de Confidentialité
            </h1>
            <p className="text-muted-foreground">
              Dernière mise à jour : <strong>25 avril 2026</strong>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Chez AgroLoopCI, la protection de vos données personnelles est une priorité.
              Cette politique décrit comment nous collectons, utilisons et protégeons vos informations.
            </p>
          </div>
        </div>
      </section>

      {/* Sommaire */}
      <section className="py-10 bg-muted/20 border-b">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Sommaire</p>
          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sections.map((s) => (
              <a
                key={s.title}
                href={`#${s.title.replace(/\s+/g, "-").toLowerCase()}`}
                className="text-sm text-primary hover:underline"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 bg-background">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto">
          <div className="space-y-12">
            {sections.map((s) => (
              <div
                key={s.title}
                id={s.title.replace(/\s+/g, "-").toLowerCase()}
                className="scroll-mt-24"
              >
                <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">
                  {s.title}
                </h2>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm">
                  {s.content}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 p-6 bg-primary/5 rounded-2xl border border-primary/10 text-center space-y-3">
            <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold text-foreground">Des questions sur vos données ?</p>
            <p className="text-sm text-muted-foreground">
              Notre équipe est disponible pour répondre à toutes vos questions relatives à la protection de vos données personnelles.
            </p>
            <a
              href="mailto:privacy@agroloopci.ci"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              privacy@agroloopci.ci
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-4 justify-center text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              ← Retour à l'accueil
            </Link>
            <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">
              À propos
            </Link>
            <Link href="/marketplace" className="text-muted-foreground hover:text-primary transition-colors">
              Marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
