import { Link } from "wouter";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  message: string;
  testId?: string;
};

export function FeatureLockedBanner({ title = "Fonctionnalité Pro", message, testId }: Props) {
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3"
      data-testid={testId ?? "feature-locked-banner"}
    >
      <div className="rounded-full bg-amber-100 p-2 shrink-0">
        <Lock className="h-4 w-4 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 text-sm">{title}</p>
        <p className="text-sm text-amber-800 mt-0.5">{message}</p>
      </div>
      <Link href="/abonnement">
        <Button size="sm" className="shrink-0 bg-amber-600 hover:bg-amber-700 gap-1">
          Passer Pro <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}
