import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, PenLine, Check, Clock, FileText } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const dateFR = (s: string | null) =>
  s ? new Date(s).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export default function TransactionDetail() {
  const [, params] = useRoute("/transactions/:id");
  const txId = params ? Number(params.id) : NaN;
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [signOpen, setSignOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function fetchPdfBlob(): Promise<string | null> {
    const token = localStorage.getItem("agroloop_token");
    try {
      const r = await fetch(`/api/contracts/${txId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error("Téléchargement impossible");
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Téléchargement échoué", variant: "destructive" });
      return null;
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await fetchPdfBlob();
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `AgroLoopCI_${contractQ.data?.reference ?? txId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setDownloading(false);
    }
  }

  async function handleOpenPreview() {
    if (typeof window !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      // On mobile, just download — iframes are unreliable.
      await handleDownload();
      return;
    }
    const url = await fetchPdfBlob();
    if (!url) return;
    setPdfBlobUrl(url);
    setPreviewOpen(true);
  }

  useEffect(() => {
    if (!previewOpen && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  }, [previewOpen, pdfBlobUrl]);

  const txQ = useQuery({
    queryKey: ["transaction", txId],
    queryFn: () => customFetch<any>(`/api/transactions/${txId}`),
    enabled: Number.isFinite(txId),
  });

  const contractQ = useQuery({
    queryKey: ["contract", txId],
    queryFn: async () => {
      try {
        return await customFetch<any>(`/api/contracts/${txId}`);
      } catch {
        return null;
      }
    },
    enabled: Number.isFinite(txId),
  });

  const sign = useMutation({
    mutationFn: () => customFetch<any>(`/api/contracts/${txId}/sign`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Signature enregistrée", description: "Votre signature électronique a été horodatée." });
      setSignOpen(false);
      setAccepted(false);
      qc.invalidateQueries({ queryKey: ["contract", txId] });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.message ?? "Signature impossible", variant: "destructive" }),
  });

  if (!Number.isFinite(txId)) return <div className="p-8 text-center">Transaction introuvable</div>;
  if (txQ.isLoading) return <div className="p-8 max-w-3xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
  if (txQ.isError || !txQ.data) return <div className="p-8 text-center text-red-600">Transaction introuvable ou accès refusé</div>;

  const tx = txQ.data;
  const c = contractQ.data;
  const isSeller = user?.id === tx.sellerId;
  const isBuyer = user?.id === tx.buyerId;
  const myRole = isSeller ? "vendeur" : isBuyer ? "acheteur" : null;
  const alreadySigned = c && (isSeller ? !!c.seller_signed_at : isBuyer ? !!c.buyer_signed_at : true);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-4" data-testid="transaction-detail">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction #{tx.id}</h1>
        <Badge variant={tx.status === "confirmée" ? "default" : tx.status === "annulée" ? "destructive" : "secondary"}>
          {tx.status}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Type :</span> <strong>{tx.typeResidu}</strong></div>
          <div><span className="text-muted-foreground">Quantité :</span> {fmt(tx.quantityKg)} kg</div>
          <div><span className="text-muted-foreground">Montant :</span> <strong>{fmt(tx.totalFcfa)} FCFA</strong></div>
          <div><span className="text-muted-foreground">Vendeur :</span> {tx.sellerName}</div>
          <div><span className="text-muted-foreground">Acheteur :</span> {tx.buyerName}</div>
        </CardContent>
      </Card>

      {tx.status === "confirmée" && (
        <Card className="border-l-4 border-l-green-600 shadow-sm" data-testid="contract-card">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Bon de commande
              </CardTitle>
              {c && <Badge variant="outline" className="font-mono" data-testid="contract-reference">{c.reference}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {contractQ.isLoading && <Skeleton className="h-24 w-full" />}
            {!contractQ.isLoading && !c && (
              <div className="text-sm text-muted-foreground">Génération du bon de commande en cours… Réessayez dans un instant.</div>
            )}
            {c && (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="h-4 w-4" /> Généré le {dateFR(c.generated_at)}
                  </div>
                  <div className="flex items-center gap-2" data-testid="seller-signature-status">
                    {c.seller_signed_at ? (
                      <><Check className="h-4 w-4 text-green-600" /> <span className="text-green-700">Signé par le vendeur</span> <span className="text-muted-foreground text-xs">— {dateFR(c.seller_signed_at)}</span></>
                    ) : (
                      <><Clock className="h-4 w-4 text-orange-500" /> <span className="text-orange-700">En attente de signature vendeur</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-2" data-testid="buyer-signature-status">
                    {c.buyer_signed_at ? (
                      <><Check className="h-4 w-4 text-green-600" /> <span className="text-green-700">Signé par l'acheteur</span> <span className="text-muted-foreground text-xs">— {dateFR(c.buyer_signed_at)}</span></>
                    ) : (
                      <><Clock className="h-4 w-4 text-orange-500" /> <span className="text-orange-700">En attente de signature acheteur</span></>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={handleOpenPreview} data-testid="button-preview-contract">
                    <Eye className="h-4 w-4 mr-1" /> Aperçu du contrat
                  </Button>
                  <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50" onClick={handleDownload} disabled={downloading} data-testid="button-download-contract">
                    <Download className="h-4 w-4 mr-1" /> {downloading ? "…" : "Télécharger le PDF"}
                  </Button>
                  {myRole && !alreadySigned && (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => setSignOpen(true)} data-testid="button-sign-contract">
                      <PenLine className="h-4 w-4 mr-1" /> Signer le document
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signature confirmation */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer votre signature</DialogTitle>
            <DialogDescription>
              En signant, vous confirmez avoir lu et accepté les conditions du bon de commande Réf. {c?.reference}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} data-testid="checkbox-accept-terms" />
            <span>J'ai lu et j'accepte les conditions</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Votre signature électronique sera horodatée et enregistrée de manière sécurisée.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={!accepted || sign.isPending} onClick={() => sign.mutate()} data-testid="button-confirm-signature">
              {sign.isPending ? "…" : "Signer électroniquement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Aperçu — {c?.reference}</DialogTitle>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                <Download className="h-4 w-4 mr-1" /> Télécharger
              </Button>
            </div>
          </DialogHeader>
          {pdfBlobUrl ? (
            <iframe src={pdfBlobUrl} className="flex-1 w-full border rounded" title="Aperçu du contrat" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Chargement…</div>
          )}
        </DialogContent>
      </Dialog>

      <div>
        <Link href={isSeller ? "/dashboard/producteur" : "/dashboard/transformateur"} className="text-sm text-green-700 underline">
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
