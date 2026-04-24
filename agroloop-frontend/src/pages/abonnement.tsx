import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Check, X, Crown, Sparkles, Zap, Loader2, Clock, AlertCircle, Upload, FileText,
  Image as ImageIcon, Copy, ChevronLeft, ChevronRight, CheckCircle2,
} from "lucide-react";
import {
  subscriptionsApi, paymentSettingsApi, type Plan, type PaymentMethod, type Subscription,
  PLAN_LABELS, PAYMENT_METHOD_LABELS,
} from "@/lib/subscriptions-api";
import { CheckoutPaymentList } from "@/components/checkout-payment-list";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROOF_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

const FCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const FEATURE_ROWS: { key: keyof Plan["features"] | "contacts"; label: string }[] = [
  { key: "contacts", label: "Contacts par mois" },
  { key: "alertes_matching", label: "Alertes par email & notifications" },
  { key: "telechargement_contrats", label: "Téléchargement des bons de commande PDF" },
  { key: "filtre_distance", label: "Filtre par distance & rayon" },
  { key: "rapports_filiere", label: "Rapports analytics par filière" },
  { key: "api_access", label: "Accès API" },
  { key: "badge_pro", label: "Badge Pro sur votre profil" },
  { key: "account_manager", label: "Account manager dédié" },
];

const PLAN_ICONS = { gratuit: Zap, pro: Sparkles, business: Crown };
const PLAN_COLORS = {
  gratuit: { ring: "ring-border/50", iconBg: "bg-muted text-muted-foreground", btn: "bg-muted text-foreground hover:bg-muted/80" },
  pro: { ring: "ring-primary/40 ring-2", iconBg: "bg-primary/10 text-primary", btn: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  business: { ring: "ring-amber-300", iconBg: "bg-amber-100 text-amber-700", btn: "bg-amber-600 hover:bg-amber-700 text-white" },
};

type PendingReceipt = {
  plan_name: "pro" | "business";
  amount_fcfa: number;
  payment_method: PaymentMethod;
  payment_reference: string | null;
};

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Mode de paiement",
  2: "Effectuer le paiement",
  3: "Preuve de paiement",
};

export default function AbonnementPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [paymentRef, setPaymentRef] = useState("");
  const [receipt, setReceipt] = useState<PendingReceipt | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [paymentDoneChecked, setPaymentDoneChecked] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resetWizard = () => {
    setSelectedPlan(null);
    setMethod(undefined);
    setPaymentRef("");
    setStep(1);
    setPaymentDoneChecked(false);
    setProofFile(null);
    setProofDataUrl(null);
    setProofError(null);
    setDragActive(false);
  };

  const { data: paymentSettings } = useQuery({
    queryKey: ["public-payment-settings"],
    queryFn: () => paymentSettingsApi.listPublic(),
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: () => subscriptionsApi.listPlans(),
  });

  const { data: me } = useQuery({
    queryKey: ["subscription-me"],
    queryFn: () => subscriptionsApi.me(),
    enabled: !!user,
  });

  const subscribe = useMutation({
    mutationFn: () => subscriptionsApi.subscribe({
      plan_name: selectedPlan!.name as "pro" | "business",
      payment_method: method!,
      payment_reference: paymentRef || undefined,
      payment_proof_base64: proofDataUrl!,
      payment_proof_filename: proofFile!.name,
    }),
    onSuccess: (data) => {
      setReceipt({
        plan_name: data.plan.name as "pro" | "business",
        amount_fcfa: data.plan.price_fcfa,
        payment_method: method!,
        payment_reference: data.subscription.payment_reference ?? paymentRef ?? null,
      });
      qc.invalidateQueries({ queryKey: ["subscription-me"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      resetWizard();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec du paiement", variant: "destructive" }),
  });

  const handleProofFile = async (file: File | null | undefined) => {
    setProofError(null);
    if (!file) return;
    if (!ACCEPTED_PROOF_MIMES.includes(file.type)) {
      setProofError("Format non autorisé. Acceptés : JPG, PNG, WEBP, PDF.");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setProofError(`Fichier trop volumineux (max ${MAX_PROOF_BYTES / 1024 / 1024} Mo).`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setProofFile(file);
      setProofDataUrl(dataUrl);
    } catch {
      setProofError("Lecture du fichier impossible. Réessayez.");
    }
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copié", description: text }); }
    catch { toast({ title: "Erreur", description: "Copie impossible", variant: "destructive" }); }
  };

  const selectedSetting = paymentSettings?.find((s: any) => s.method === method);

  const cancel = useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: () => {
      toast({ title: "Abonnement annulé", description: "Vous gardez l'accès jusqu'à la fin de la période." });
      qc.invalidateQueries({ queryKey: ["subscription-me"] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Échec", variant: "destructive" }),
  });

  const pending: Subscription | null = me?.pending_subscription ?? null;

  const handleChoose = (plan: Plan) => {
    if (!user) { setLocation("/login"); return; }
    if (user.role !== "transformateur") {
      toast({ title: "Réservé aux transformateurs", description: "Les abonnements concernent uniquement les transformateurs.", variant: "destructive" });
      return;
    }
    if (plan.name === "gratuit") return;
    if (pending) {
      toast({
        title: "Demande déjà en cours",
        description: "Une demande d'abonnement est en attente de vérification.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPlan(plan);
    setMethod(paymentSettings?.[0]?.method);
  };

  const currentPlanName = me?.plan.name ?? null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl" data-testid="abonnement-page">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Choisissez votre abonnement</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
          Trouvez le plan qui correspond à votre activité de transformation. Sans engagement, annulable à tout moment.
        </p>
      </div>

      {pending && (
        <div
          className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3"
          data-testid="pending-subscription-banner"
        >
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Demande d'abonnement {PLAN_LABELS[(pending.plan_name ?? "pro") as "pro" | "business"]} en attente de vérification
            </p>
            <p className="text-amber-800 mt-1">
              Notre équipe vérifie votre paiement{pending.payment_method ? ` (${PAYMENT_METHOD_LABELS[pending.payment_method as PaymentMethod] ?? pending.payment_method})` : ""}.
              Vous recevrez une notification dès activation. Vos fonctionnalités actuelles restent inchangées en attendant.
            </p>
            {pending.payment_reference && (
              <p className="text-xs text-amber-700 mt-1">Référence : {pending.payment_reference}</p>
            )}
          </div>
        </div>
      )}

      {plansLoading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[480px] w-full" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans?.map((plan) => {
            const Icon = PLAN_ICONS[plan.name];
            const colors = PLAN_COLORS[plan.name];
            const isCurrent = currentPlanName === plan.name;
            return (
              <Card
                key={plan.id}
                className={`border-none shadow-sm ring-1 ${colors.ring} flex flex-col relative ${plan.is_popular ? "md:scale-105" : ""}`}
                data-testid={`card-plan-${plan.name}`}
              >
                {plan.is_popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">Le plus populaire</Badge>
                )}
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center mb-3`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-2xl">{PLAN_LABELS[plan.name]}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price_fcfa === 0 ? "0" : FCFA(plan.price_fcfa)}</span>
                    <span className="text-muted-foreground ml-1">FCFA{plan.price_fcfa > 0 ? "/mois" : ""}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {FEATURE_ROWS.map((row) => {
                    let included: boolean;
                    let label: string = row.label;
                    if (row.key === "contacts") {
                      included = true;
                      label = `${plan.contacts_per_month === -1 ? "Contacts illimités" : `${plan.contacts_per_month} contacts par mois`}`;
                    } else {
                      included = plan.features[row.key];
                    }
                    return (
                      <div key={row.label} className="flex items-start gap-2 text-sm">
                        {included ? (
                          <Check className="h-5 w-5 text-primary shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={included ? "text-foreground" : "text-muted-foreground/60 line-through"}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  {isCurrent ? (
                    <>
                      <Button disabled className="w-full" variant="outline" data-testid={`btn-current-${plan.name}`}>
                        Plan actuel
                      </Button>
                      {plan.name !== "gratuit" && me?.subscription?.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-destructive"
                          onClick={() => cancel.mutate()}
                          disabled={cancel.isPending}
                          data-testid={`btn-cancel-${plan.name}`}
                        >
                          {cancel.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
                          Annuler l'abonnement
                        </Button>
                      )}
                    </>
                  ) : plan.name === "gratuit" ? (
                    <Button disabled className="w-full" variant="outline">Inclus à l'inscription</Button>
                  ) : pending ? (
                    <Button disabled className="w-full" variant="outline" data-testid={`btn-pending-${plan.name}`}>
                      <Clock className="h-4 w-4 mr-2" />
                      Demande en cours
                    </Button>
                  ) : (
                    <Button
                      className={`w-full ${colors.btn}`}
                      onClick={() => handleChoose(plan)}
                      data-testid={`btn-choose-${plan.name}`}
                    >
                      Choisir {PLAN_LABELS[plan.name]}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {!user && (
        <div className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">Connectez-vous</Link> pour souscrire à un plan.
        </div>
      )}

      <Dialog open={!!selectedPlan} onOpenChange={(o) => { if (!o) resetWizard(); }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" data-testid="subscribe-modal">
          <DialogHeader>
            <DialogTitle>
              Souscrire au plan {selectedPlan && PLAN_LABELS[selectedPlan.name]}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Assistant en {Object.keys(STEP_LABELS).length} étapes pour souscrire à un abonnement.
            </DialogDescription>
          </DialogHeader>

          {/* PROGRESS INDICATOR */}
          <ol className="flex items-center gap-1 text-xs my-2" data-testid="wizard-steps">
            {([1, 2, 3] as WizardStep[]).map((n, idx) => {
              const active = step === n;
              const done = step > n;
              return (
                <li key={n} className="flex-1 flex items-center gap-1 min-w-0">
                  <div
                    className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-semibold transition-colors ${
                      done ? "bg-primary text-primary-foreground" :
                      active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                      "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-bullet-${n}`}
                  >
                    {done ? <Check className="h-4 w-4" /> : n}
                  </div>
                  <span className={`truncate hidden sm:inline ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {STEP_LABELS[n]}
                  </span>
                  {idx < 2 && (
                    <div className={`flex-1 h-px mx-1 ${done ? "bg-primary" : "bg-border"}`} />
                  )}
                </li>
              );
            })}
          </ol>

          {/* STEP 1 — METHOD */}
          {step === 1 && (
            <div className="space-y-4 py-2" data-testid="wizard-step-1">
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
                Montant à payer :{" "}
                <strong>{selectedPlan && FCFA(selectedPlan.price_fcfa)} FCFA</strong>
                {" "}pour 30 jours
              </div>
              <div>
                <Label className="mb-2 block">Choisir le mode de paiement</Label>
                <CheckoutPaymentList
                  settings={paymentSettings ?? []}
                  selected={method}
                  onSelect={(m) => setMethod(m)}
                />
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={resetWizard}>Annuler</Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!method}
                  data-testid="btn-step1-next"
                >
                  Suivant <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 2 — DO PAYMENT */}
          {step === 2 && (
            <div className="space-y-4 py-2" data-testid="wizard-step-2">
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-center">
                <div className="text-xs text-muted-foreground">Montant à payer</div>
                <div className="text-2xl font-bold text-primary">
                  {selectedPlan && FCFA(selectedPlan.price_fcfa)} FCFA
                </div>
              </div>

              {selectedSetting ? (
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    {PAYMENT_METHOD_LABELS[selectedSetting.method as PaymentMethod] ?? selectedSetting.method}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nom du compte</span>
                    <div className="font-medium">{selectedSetting.account_name}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Numéro</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-base font-semibold">{selectedSetting.number}</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(selectedSetting.number)}
                        data-testid="btn-copy-number"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copier
                      </Button>
                    </div>
                  </div>
                  {selectedSetting.instructions && (
                    <div>
                      <span className="text-muted-foreground text-xs">Instructions</span>
                      <div className="text-sm italic">{selectedSetting.instructions}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucun détail pour ce mode.</div>
              )}

              <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <Checkbox
                  checked={paymentDoneChecked}
                  onCheckedChange={(c) => setPaymentDoneChecked(c === true)}
                  data-testid="check-payment-done"
                  className="mt-0.5"
                />
                <span className="text-sm">J'ai effectué le paiement sur ce numéro</span>
              </label>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Retour
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!paymentDoneChecked}
                  data-testid="btn-step2-next"
                >
                  J'ai payé <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* STEP 3 — UPLOAD PROOF */}
          {step === 3 && (
            <div className="space-y-4 py-2" data-testid="wizard-step-3">
              <div>
                <h3 className="font-semibold">Joindre la preuve de paiement</h3>
                <p className="text-sm text-muted-foreground">
                  Téléchargez une capture d'écran ou le reçu de votre paiement.
                </p>
              </div>

              {!proofFile ? (
                <label
                  htmlFor="proof-input"
                  className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                    dragActive ? "border-primary bg-primary/10" : "border-primary/40 hover:bg-primary/5"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    handleProofFile(e.dataTransfer.files?.[0]);
                  }}
                  data-testid="proof-dropzone"
                >
                  <Upload className="h-8 w-8 text-primary" />
                  <div className="text-sm text-center">
                    <div className="font-medium">Glissez votre fichier ici ou cliquez pour parcourir</div>
                    <div className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF · Max 5 Mo</div>
                  </div>
                </label>
              ) : (
                <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 space-y-2" data-testid="proof-preview">
                  {proofFile.type.startsWith("image/") && proofDataUrl ? (
                    <img
                      src={proofDataUrl}
                      alt="Aperçu de la preuve"
                      className="w-full max-h-[200px] object-contain rounded"
                      data-testid="proof-image-preview"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-2">
                      <FileText className="h-10 w-10 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{proofFile.name}</div>
                        <div className="text-xs text-muted-foreground">{formatFileSize(proofFile.size)}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Fichier sélectionné
                    </span>
                    <label htmlFor="proof-input" className="text-xs text-primary hover:underline cursor-pointer">
                      Changer le fichier
                    </label>
                  </div>
                </div>
              )}

              <input
                id="proof-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                {...({ capture: "environment" } as Record<string, string>)}
                className="hidden"
                onChange={(e) => handleProofFile(e.target.files?.[0])}
                data-testid="input-proof-file"
              />

              {proofError && (
                <div className="text-sm text-destructive flex items-center gap-2" data-testid="proof-error">
                  <AlertCircle className="h-4 w-4" /> {proofError}
                </div>
              )}

              <div>
                <Label htmlFor="payment-ref" className="mb-2 block">
                  Référence de transaction <span className="text-muted-foreground">(optionnel)</span>
                </Label>
                <Input
                  id="payment-ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Ex : OM-789123456"
                  data-testid="input-payment-ref"
                />
                <p className="text-xs text-muted-foreground mt-1">L'identifiant de transaction reçu par SMS.</p>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-xs text-amber-900">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  La preuve de paiement est obligatoire pour activer votre abonnement.
                  Un administrateur vérifiera votre paiement (généralement sous 24h ouvrées).
                </span>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Retour
                </Button>
                <Button
                  onClick={() => subscribe.mutate()}
                  disabled={subscribe.isPending || !proofFile || !proofDataUrl}
                  title={!proofFile ? "Veuillez joindre une preuve de paiement" : undefined}
                  data-testid="btn-confirm-subscribe"
                >
                  {subscribe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Activer mon abonnement
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent data-testid="receipt-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Demande reçue, en cours de vérification
            </DialogTitle>
            <DialogDescription>
              Merci ! Nous avons bien enregistré votre demande d'abonnement.
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan demandé</span>
                  <strong>{PLAN_LABELS[receipt.plan_name]}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <strong>{FCFA(receipt.amount_fcfa)} FCFA</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mode de paiement</span>
                  <strong>{PAYMENT_METHOD_LABELS[receipt.payment_method] ?? receipt.payment_method}</strong>
                </div>
                {receipt.payment_reference && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Référence</span>
                    <strong className="font-mono text-xs">{receipt.payment_reference}</strong>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">
                Notre équipe vérifie votre paiement et active votre plan dès confirmation.
                Vous recevrez une notification — généralement sous 24h ouvrées.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReceipt(null)} data-testid="btn-close-receipt">J'ai compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
