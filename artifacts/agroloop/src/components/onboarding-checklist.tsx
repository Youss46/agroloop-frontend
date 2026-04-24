import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/components/auth-provider";
import {
  useGetMesOffres,
  useListConversations,
  getGetMesOffresQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, ArrowRight, X, Sparkles } from "lucide-react";

const SEARCH_EVENT = "agroloop:search-performed";
const searchKey = (uid: number) => `agroloop_did_search_${uid}`;
const dismissKey = (uid: number) => `agroloop_onboarding_dismissed_${uid}`;
const celebratedKey = (uid: number) => `agroloop_onboarding_celebrated_${uid}`;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function markSearchPerformed(userId: number | null | undefined): void {
  if (!userId) return;
  safeSet(searchKey(userId), "1");
  try { window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { detail: { userId } })); } catch { /* ignore */ }
}

interface Step {
  key: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
}

export function OnboardingChecklist() {
  const { user } = useAuth();
  const role = user?.role;
  const userId = user?.id;
  const isProducteur = role === "producteur";
  const isTransformateur = role === "transformateur";
  const enabled = isProducteur || isTransformateur;

  const { data: offres } = useGetMesOffres({
    query: { queryKey: getGetMesOffresQueryKey(), enabled: isProducteur },
  });
  const { data: conversations } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), enabled },
  });

  const [didSearch, setDidSearch] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Re-hydrate per-user flags whenever the active user changes.
  useEffect(() => {
    if (!userId) { setDidSearch(false); setDismissed(false); return; }
    setDidSearch(safeGet(searchKey(userId)) === "1");
    setDismissed(safeGet(dismissKey(userId)) === "1");
  }, [userId]);

  // React to flag updates from the same tab (custom event) or other tabs (storage event).
  useEffect(() => {
    if (!userId) return;
    const refreshSearch = () => setDidSearch(safeGet(searchKey(userId)) === "1");
    const refreshDismiss = () => setDismissed(safeGet(dismissKey(userId)) === "1");
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<{ userId?: number }>;
      if (!ce.detail || ce.detail.userId === userId) refreshSearch();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === searchKey(userId)) refreshSearch();
      else if (e.key === dismissKey(userId)) refreshDismiss();
    };
    window.addEventListener(SEARCH_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SEARCH_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  const profileComplete = !!(user?.phone && user?.region);
  const hasOffer = Array.isArray(offres) && offres.length > 0;
  const hasConversation = Array.isArray(conversations) && conversations.length > 0;

  const steps: Step[] = useMemo(() => {
    if (!enabled || !user) return [];
    const profileStep: Step = {
      key: "profile",
      title: "Compléter votre profil",
      description: "Ajoutez votre téléphone et votre région pour gagner la confiance des partenaires.",
      done: profileComplete,
      href: "/profil/modifier",
      cta: "Compléter mon profil",
    };
    if (isProducteur) {
      return [
        profileStep,
        {
          key: "first-offer",
          title: "Publier votre 1ère offre de résidu",
          description: "Mettez en ligne votre premier résidu pour être visible des transformateurs.",
          done: hasOffer,
          href: "/offres/nouvelle",
          cta: "Publier une offre",
        },
        {
          key: "first-conversation",
          title: "Démarrer une 1ère conversation",
          description: "Échangez avec un transformateur pour préparer votre première vente.",
          done: hasConversation,
          href: "/messages",
          cta: "Voir mes messages",
        },
      ];
    }
    return [
      profileStep,
      {
        key: "first-search",
        title: "Lancer votre 1ère recherche",
        description: "Saisissez un mot-clé ou appliquez un filtre dans la marketplace pour trouver des résidus.",
        done: didSearch,
        href: "/marketplace",
        cta: "Aller à la marketplace",
      },
      {
        key: "first-conversation",
        title: "Contacter un 1er producteur",
        description: "Envoyez un message à un producteur pour démarrer votre 1ère mise en relation.",
        done: hasConversation,
        href: "/marketplace",
        cta: "Trouver un producteur",
      },
    ];
  }, [enabled, user, isProducteur, profileComplete, hasOffer, hasConversation, didSearch]);

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const progress = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  const justCelebrated = useMemo(() => {
    if (!userId || !allDone) return false;
    return safeGet(celebratedKey(userId)) !== "1";
  }, [userId, allDone]);

  useEffect(() => {
    if (!userId || !allDone || !justCelebrated) return;
    safeSet(celebratedKey(userId), "1");
  }, [userId, allDone, justCelebrated]);

  if (!enabled || !user) return null;
  if (dismissed) return null;
  if (allDone && !justCelebrated) return null;

  const nextStep = steps.find((s) => !s.done);

  const onDismiss = () => {
    if (!userId) return;
    safeSet(dismissKey(userId), "1");
    setDismissed(true);
  };

  if (allDone) {
    return (
      <Card className="mb-6 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent" data-testid="onboarding-celebration">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Bravo, votre démarrage est complet !</div>
            <div className="text-sm text-muted-foreground">Vous avez franchi les 3 premières étapes. Bonne suite sur AgroLoopCI.</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="onboarding-celebration-close">Fermer</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary/30" data-testid="onboarding-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Bienvenue sur AgroLoopCI
              <span className="text-xs font-normal text-muted-foreground">{doneCount}/{total} étapes</span>
            </CardTitle>
            <CardDescription>Suivez ces étapes pour bien démarrer.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            aria-label="Masquer la liste de démarrage"
            data-testid="onboarding-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={progress} className="mt-3 h-2" data-testid="onboarding-progress" />
      </CardHeader>
      <CardContent className="pt-0">
        <ol className="space-y-2">
          {steps.map((step, idx) => {
            const isNext = !step.done && step === nextStep;
            return (
              <li
                key={step.key}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  step.done ? "bg-muted/30 border-muted" : isNext ? "bg-primary/5 border-primary/40" : "bg-card"
                }`}
                data-testid={`onboarding-step-${step.key}`}
              >
                <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {step.done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                      {idx + 1}. {step.title}
                    </span>
                    {step.done && <span className="text-xs text-primary font-medium">Terminé</span>}
                  </div>
                  {!step.done && (
                    <div className="text-sm text-muted-foreground mt-0.5">{step.description}</div>
                  )}
                </div>
                {!step.done && (
                  <Link href={step.href}>
                    <Button size="sm" variant={isNext ? "default" : "outline"} className="gap-1 flex-shrink-0" data-testid={`onboarding-cta-${step.key}`}>
                      {step.cta}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
