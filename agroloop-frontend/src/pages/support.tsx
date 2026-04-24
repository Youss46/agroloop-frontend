import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LifeBuoy, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import {
  createSupportTicket,
  fetchMyTickets,
  fetchSupportSettings,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_LABELS,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
} from "@/lib/support-api";

const FAQ: { q: string; a: string; link?: { href: string; label: string } }[] = [
  {
    q: "Comment vérifier mon compte ?",
    a: "Rendez-vous sur la page Vérification, téléversez une pièce d'identité (CNI ou passeport) puis, pour les professionnels, un document comme la carte de coopérative ou le RCCM.",
    link: { href: "/verification", label: "Vérifier mon compte" },
  },
  {
    q: "Pourquoi mon offre n'apparaît-elle pas dans la marketplace ?",
    a: "Les offres restent disponibles 7 jours. Après expiration, renouvelez-les depuis votre tableau de bord. Vérifiez également que le statut est « disponible ».",
  },
  {
    q: "Comment envoyer une demande de devis ?",
    a: "Ouvrez une offre dans la marketplace et cliquez sur « Demander un devis ». Le vendeur a 48h pour répondre.",
  },
  {
    q: "Comment mettre à niveau mon abonnement ?",
    a: "Consultez la page Abonnement pour comparer les plans et demander l'activation d'un plan supérieur.",
    link: { href: "/abonnement", label: "Voir les abonnements" },
  },
  {
    q: "Comment modifier mes préférences de notification ?",
    a: "Allez dans Préférences pour activer ou désactiver chaque type de notification.",
    link: { href: "/preferences", label: "Mes préférences" },
  },
];

function statusBadge(status: SupportStatus) {
  const map: Record<SupportStatus, string> = {
    ouvert: "bg-amber-100 text-amber-800",
    en_cours: "bg-blue-100 text-blue-800",
    resolu: "bg-green-100 text-green-800",
    ferme: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge variant="outline" className={`${map[status]} border-none`}>
      {SUPPORT_STATUS_LABELS[status]}
    </Badge>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md p-4" data-testid={`ticket-${ticket.id}`}>
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{ticket.subject}</span>
            {statusBadge(ticket.status)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {SUPPORT_CATEGORY_LABELS[ticket.category]} · {formatDate(ticket.createdAt)}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-1" />}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Votre message</div>
            <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-3">{ticket.message}</p>
          </div>
          {ticket.adminResponse && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Réponse du support {ticket.respondedAt ? `— ${formatDate(ticket.respondedAt)}` : ""}
              </div>
              <p className="text-sm whitespace-pre-wrap bg-primary/5 border border-primary/20 rounded p-3">
                {ticket.adminResponse}
              </p>
            </div>
          )}
          {!ticket.adminResponse && ticket.status === "ouvert" && (
            <p className="text-xs text-muted-foreground italic">En attente de traitement par le support.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportCategory>("autre");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["support-tickets-mine"],
    queryFn: fetchMyTickets,
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["support-settings"],
    queryFn: fetchSupportSettings,
  });

  const whatsappHref = (() => {
    if (!settings?.whatsappNumber) return null;
    const roleLabel =
      user?.role === "producteur"
        ? "Producteur"
        : user?.role === "transformateur"
          ? "Transformateur"
          : user?.role
            ? "Utilisateur"
            : "Visiteur";
    const lines = [
      "Bonjour AgroLoopCI 👋",
      "",
      "J'ai besoin d'aide.",
      "",
      `Mon compte : ${user?.email ?? "(non connecté)"}`,
      `Mon rôle : ${roleLabel}`,
      "",
      "Mon problème : ",
    ];
    return `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  })();

  const createMutation = useMutation({
    mutationFn: createSupportTicket,
    onSuccess: () => {
      toast({ title: "Demande envoyée", description: "Notre équipe vous répondra dans les meilleurs délais." });
      setSubject("");
      setCategory("autre");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["support-tickets-mine"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err?.message ?? "Impossible d'envoyer la demande.",
        variant: "destructive",
      });
    },
  });

  const tickets = data?.items ?? [];
  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 10 && !createMutation.isPending;

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-3xl">
      <div className="flex items-start gap-3 mb-6">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aide et support</h1>
          <p className="text-muted-foreground mt-1">
            Consultez les réponses les plus fréquentes ci-dessous. Si elles ne couvrent pas votre préoccupation, contactez directement notre équipe support.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Questions fréquentes</CardTitle>
          <CardDescription>Les réponses les plus demandées par nos utilisateurs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {FAQ.map((item, i) => (
            <details key={i} className="rounded-md border p-3 group" data-testid={`faq-${i}`}>
              <summary className="cursor-pointer font-medium text-sm flex items-center justify-between gap-2">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{item.a}</p>
              {item.link && (
                <Link href={item.link.href}>
                  <Button variant="link" className="px-0 mt-1 h-auto">
                    {item.link.label} →
                  </Button>
                </Link>
              )}
            </details>
          ))}
        </CardContent>
      </Card>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Besoin d'une réponse rapide ?
      </div>

      <div
        className="mb-6 rounded-xl p-4 border"
        style={{ backgroundColor: "#dcfce7", borderColor: "#16a34a" }}
        data-testid="card-whatsapp-support"
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none mt-0.5" aria-hidden>💬</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-green-900">Contacter via WhatsApp</div>
            <div className="text-sm text-green-800 mt-0.5">
              Réponse rapide · {settings?.supportHours ?? "Lun–Sam 8h–18h"}
            </div>
          </div>
        </div>
        <a
          href={whatsappHref ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!whatsappHref}
          onClick={(e) => {
            if (!whatsappHref) e.preventDefault();
          }}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 ${
            !whatsappHref ? "opacity-60 cursor-not-allowed" : ""
          }`}
          data-testid="button-whatsapp-open"
        >
          <span aria-hidden>💬</span> Ouvrir WhatsApp
        </a>
      </div>

      <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>ou remplissez le formulaire ci-dessous</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Card className="mb-6" data-testid="card-contact-support">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Contacter le support
          </CardTitle>
          <CardDescription>
            Votre question n'est pas couverte ci-dessus ? Décrivez votre préoccupation et notre équipe vous répondra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline">
                Connectez-vous
              </Link>{" "}
              pour envoyer une demande au support.
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                createMutation.mutate({ subject: subject.trim(), category, message: message.trim() });
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="support-subject">Sujet</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={120}
                    placeholder="Résumé de votre demande"
                    data-testid="input-support-subject"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="support-category">Catégorie</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as SupportCategory)}>
                    <SelectTrigger id="support-category" data-testid="select-support-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUPPORT_CATEGORY_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="support-message">Votre message</Label>
                <Textarea
                  id="support-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="Décrivez votre préoccupation en détail (au moins 10 caractères)"
                  data-testid="input-support-message"
                  required
                />
                <div className="text-xs text-muted-foreground mt-1">{message.length}/2000</div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSubmit} data-testid="button-support-submit">
                  {createMutation.isPending ? "Envoi..." : "Envoyer ma demande"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mes demandes</CardTitle>
            <CardDescription>Suivez l'état de vos demandes et consultez les réponses du support.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="empty-support-tickets">
                Vous n'avez pas encore envoyé de demande.
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => <TicketRow key={t.id} ticket={t} />)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
