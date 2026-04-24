import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VerificationBadge } from "@/components/verification-badge";
import { Trash2, Upload, ShieldCheck, BadgeCheck, AlertCircle, X } from "lucide-react";

type DocItem = { documentType: string; fileName: string; dataUrl: string };

const DOC_LABELS: Record<string, string> = {
  cni: "Carte Nationale d'Identité",
  passeport: "Passeport",
  carte_cooperative: "Carte de coopérative",
  photo_parcelle: "Photo de la parcelle",
  rccm: "RCCM (Registre du Commerce)",
  attestation_fiscale: "Attestation fiscale",
};

const IDENTITY_TYPES = ["cni", "passeport"];
const PRO_TYPES = ["carte_cooperative", "photo_parcelle", "rccm", "attestation_fiscale"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/verification/status"],
    queryFn: () => customFetch<any>("/api/verification/status", { method: "GET" }),
    enabled: !!user,
  });

  const [level, setLevel] = useState<"identite" | "professionnel">("identite");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docType, setDocType] = useState<string>("cni");

  const submit = useMutation({
    mutationFn: (body: { level: string; documents: DocItem[] }) =>
      customFetch("/api/verification/submit", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: "Demande envoyée", description: "Un administrateur examinera vos documents prochainement." });
      setDocs([]);
      qc.invalidateQueries({ queryKey: ["/api/verification/status"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err?.message || "Échec de l'envoi", variant: "destructive" });
    },
  });

  const cancel = useMutation({
    mutationFn: () => customFetch("/api/verification/cancel", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Demande annulée" });
      qc.invalidateQueries({ queryKey: ["/api/verification/status"] });
      qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err?.message || "Échec", variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <p>Vous devez être connecté.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="container max-w-3xl mx-auto py-8 px-4">Chargement...</div>;
  }

  const status = data?.verificationStatus ?? "non_verifie";
  const verifLevel = Number(data?.verificationLevel ?? 0);
  const current = data?.currentRequest;
  const isPending = current && current.status === "en_attente";

  const allowedTypes = level === "identite" ? IDENTITY_TYPES : [...IDENTITY_TYPES, ...PRO_TYPES];

  async function handleAddDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "Maximum 3 MB", variant: "destructive" });
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setDocs(prev => [...prev, { documentType: docType, fileName: file.name, dataUrl }]);
    } catch {
      toast({ title: "Erreur", description: "Lecture du fichier impossible", variant: "destructive" });
    }
    e.target.value = "";
  }

  function handleRemove(idx: number) {
    setDocs(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (docs.length === 0) {
      toast({ title: "Aucun document", description: "Ajoutez au moins un document.", variant: "destructive" });
      return;
    }
    submit.mutate({ level, documents: docs });
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6" data-testid="verification-page">
      <div>
        <h1 className="text-2xl font-bold text-emerald-900">Vérification de compte</h1>
        <p className="text-sm text-gray-600 mt-1">
          Faites vérifier votre identité et vos documents professionnels pour gagner la confiance des acheteurs et apparaître en priorité dans la marketplace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Statut actuel
            <VerificationBadge status={status} level={verifLevel} size="md" showLabel />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {verifLevel === 0 && status === "non_verifie" && (
            <p className="text-gray-700 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              Vous n'êtes pas encore vérifié. Soumettez vos documents ci-dessous.
            </p>
          )}
          {status === "en_attente" && (
            <div className="space-y-2">
              <p className="text-blue-800 flex items-center gap-2">
                <ShieldCheck size={16} />
                Votre demande est en cours d'examen.
              </p>
              <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending} data-testid="button-cancel-verification">
                <X size={14} className="mr-1" /> Annuler la demande
              </Button>
            </div>
          )}
          {verifLevel >= 1 && (
            <p className="text-emerald-800 flex items-center gap-2">
              <BadgeCheck size={16} /> Niveau {verifLevel} — {verifLevel >= 2 ? "Vérification professionnelle" : "Identité vérifiée"}
            </p>
          )}
          {current?.status === "rejetée" && current?.rejectionReason && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-red-900">
              <div className="font-medium">Demande précédente refusée</div>
              <div className="text-sm">{current.rejectionReason}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isPending && (
        <Card>
          <CardHeader>
            <CardTitle>Soumettre des documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Niveau demandé</Label>
              <Select value={level} onValueChange={(v) => { setLevel(v as any); setDocs([]); setDocType(IDENTITY_TYPES[0]); }}>
                <SelectTrigger data-testid="select-verification-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="identite">Identité (CNI ou passeport)</SelectItem>
                  <SelectItem value="professionnel">Professionnel (identité + documents pro)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {level === "identite"
                  ? "Soumettez une pièce d'identité officielle."
                  : "Joignez une pièce d'identité et au moins un document professionnel (carte coopérative, photo de parcelle, RCCM, attestation fiscale)."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="sm:col-span-2">
                <Label>Type de document</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger data-testid="select-document-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedTypes.map(t => (
                      <SelectItem key={t} value={t}>{DOC_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-file" className="block">Fichier (≤ 3 Mo)</Label>
                <Input id="doc-file" type="file" accept="image/*,application/pdf" onChange={handleAddDoc} data-testid="input-document-file" />
              </div>
            </div>

            {docs.length > 0 && (
              <ul className="space-y-2" data-testid="list-documents">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded border p-2 bg-gray-50">
                    <div className="text-sm">
                      <div className="font-medium">{DOC_LABELS[d.documentType]}</div>
                      <div className="text-gray-600 truncate max-w-[300px]">{d.fileName}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(i)} data-testid={`button-remove-doc-${i}`}>
                      <Trash2 size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={handleSubmit}
              disabled={submit.isPending || docs.length === 0}
              data-testid="button-submit-verification"
            >
              <Upload size={16} className="mr-2" />
              {submit.isPending ? "Envoi..." : "Soumettre la demande"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
