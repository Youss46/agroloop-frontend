import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { Sparkles } from "lucide-react";

export function WelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `welcome_shown_${user.id}`;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(key)) {
      setOpen(true);
      localStorage.setItem(key, "1");
    }
  }, [user]);

  if (!user) return null;

  const firstName = (user.name ?? "").split(" ")[0] || user.name;
  const isProducteur = user.role === "producteur";
  const isTransformateur = user.role === "transformateur";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-welcome">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">
            Bienvenue sur AgroLoopCI, {firstName} !
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {isProducteur && (
              <>Vous pouvez publier vos premières offres de résidus et les rendre visibles pour les transformateurs de toute la Côte d'Ivoire.</>
            )}
            {isTransformateur && (
              <>Explorez la marketplace, contactez les producteurs et négociez vos achats de résidus agricoles.</>
            )}
            {!isProducteur && !isTransformateur && (
              <>Nous sommes ravis de vous accueillir.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Astuce :</strong> vérifiez votre compte pour rassurer vos partenaires et débloquer toutes les fonctionnalités.
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-welcome-later">
            Plus tard
          </Button>
          <Link href="/verification" onClick={() => setOpen(false)}>
            <Button className="w-full" data-testid="button-welcome-verify">
              Vérifier mon compte
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
