import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, Banknote, Copy, Check, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PublicPaymentSetting, PaymentMethod } from "@/lib/subscriptions-api";

const METHOD_COLORS: Record<PaymentMethod, { bg: string; text: string }> = {
  orange_money: { bg: "bg-orange-100", text: "text-orange-600" },
  wave: { bg: "bg-blue-100", text: "text-blue-600" },
  mtn_money: { bg: "bg-yellow-100", text: "text-yellow-700" },
  virement: { bg: "bg-gray-100", text: "text-gray-600" },
};

export function CheckoutPaymentList({
  settings,
  selected,
  onSelect,
}: {
  settings: PublicPaymentSetting[];
  selected?: PaymentMethod;
  onSelect?: (m: PaymentMethod) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      toast({ title: "Copie impossible", description: "Sélectionnez et copiez manuellement.", variant: "destructive" });
    }
  };

  if (settings.length === 0) {
    return (
      <div className="text-center py-6 space-y-3" data-testid="payment-empty">
        <p className="text-sm text-muted-foreground">
          Modes de paiement temporairement indisponibles. Contactez-nous sur WhatsApp.
        </p>
        <a href="https://wa.me/2250700000000" target="_blank" rel="noreferrer">
          <Button variant="outline" className="gap-2 border-[#25D366] text-[#128C7E]">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="payment-checkout-list">
      {settings.map((s) => {
        const c = METHOD_COLORS[s.method];
        const Icon = s.method === "virement" ? Banknote : Smartphone;
        const isSelected = selected === s.method;
        const interactive = !!onSelect;
        return (
          <div
            key={s.method}
            onClick={interactive ? () => onSelect!(s.method) : undefined}
            className={`border rounded-md p-3 transition-colors ${interactive ? "cursor-pointer hover:bg-muted/40" : ""} ${isSelected ? "border-primary ring-1 ring-primary/40 bg-primary/5" : ""}`}
            data-testid={`checkout-method-${s.method}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-md ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-xs text-muted-foreground">Nom du compte : {s.account_name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span
                    className="font-mono text-sm select-all cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); copy(s.number, s.method); }}
                    data-testid={`number-${s.method}`}
                  >
                    {s.number}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={(e) => { e.stopPropagation(); copy(s.number, s.method); }}
                    aria-label="Copier le numéro"
                    data-testid={`copy-${s.method}`}
                  >
                    {copied === s.method ? (
                      <><Check className="h-3 w-3 text-primary" /> Copié !</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copier</>
                    )}
                  </Button>
                </div>
                {s.instructions && (
                  <div className="text-xs text-muted-foreground italic mt-1">{s.instructions}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
