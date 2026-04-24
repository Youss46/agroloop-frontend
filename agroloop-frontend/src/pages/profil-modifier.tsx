import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useUpdateMe, useUploadAvatar, getGetMeQueryKey } from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Trash2, ArrowLeft } from "lucide-react";

const REGIONS = [
  "Abidjan", "San Pedro", "Abengourou", "Bouaké", "Korhogo", "Yamoussoukro", "Autre",
] as const;

const FILIERES = [
  "Cacao", "Anacarde", "Plantain", "Manioc", "Riz", "Hévéa",
  "Palmier à huile", "Maïs", "Igname", "Autre",
] as const;

const MAX_BIO = 300;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

async function fileToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const target = Math.min(512, size);
        const canvas = document.createElement("canvas");
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas indisponible")); return; }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilModifier() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const updateMe = useUpdateMe();
  const uploadAvatar = useUploadAvatar();

  const [name, setName] = useState("");
  const [region, setRegion] = useState<string>("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [filieres, setFilieres] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setRegion(user.region ?? "");
    setBio((user as any).bio ?? "");
    setPhone(user.phone ?? "");
    setFilieres(Array.isArray((user as any).filieres) ? (user as any).filieres : []);
    setAvatarUrl((user as any).avatarUrl ?? null);
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-2xl space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const toggleFiliere = (f: string) => {
    setFilieres((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Format invalide", description: "Veuillez sélectionner une image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ variant: "destructive", title: "Image trop volumineuse", description: "Taille maximale: 2 Mo." });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      const res = await uploadAvatar.mutateAsync({ data: { dataUrl } });
      setAvatarUrl(res.avatarUrl);
      toast({ title: "Photo mise à jour" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Échec de l'envoi", description: err?.data?.error ?? err?.message ?? "Erreur" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeAvatar = async () => {
    try {
      await updateMe.mutateAsync({ data: { avatarUrl: null } });
      setAvatarUrl(null);
      toast({ title: "Photo supprimée" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err?.data?.error ?? "Impossible de supprimer la photo" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMe.mutateAsync({
        data: {
          name: name.trim(),
          region: region || null,
          bio: bio.trim() || null,
          phone: phone.trim() || null,
          filieres,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profil mis à jour ✓" });
      setLocation(`/profil/${user.id}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err?.data?.error ?? "Échec de la mise à jour" });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/profil/${user.id}`}>
          <Button variant="ghost" size="sm" className="gap-1"><ArrowLeft className="h-4 w-4" />Retour</Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le profil</h1>
      </div>

      <Card className="border-none shadow-sm ring-1 ring-border/50">
        <CardHeader><CardTitle className="text-base">Photo de profil</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-24 w-24">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback className="bg-[#16a34a] text-white font-bold text-xl">
              {initials(name || user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFile} data-testid="input-avatar-file" />
            <Button type="button" variant="outline" className="gap-2" onClick={() => fileInput.current?.click()} disabled={uploading} data-testid="btn-change-avatar">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Changer la photo
            </Button>
            {avatarUrl && (
              <Button type="button" variant="ghost" size="sm" className="gap-2 text-destructive" onClick={removeAvatar} data-testid="btn-remove-avatar">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer la photo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="space-y-5">
        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input id="name" data-testid="input-edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Région</Label>
              <Select value={region || "_none"} onValueChange={(v) => setRegion(v === "_none" ? "" : v)}>
                <SelectTrigger id="region" data-testid="select-edit-region"><SelectValue placeholder="Choisir une région" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucune</SelectItem>
                  {REGIONS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" data-testid="input-edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 ..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                data-testid="textarea-edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
                rows={4}
                placeholder="Présentez-vous brièvement..."
              />
              <div className="text-xs text-muted-foreground text-right">{bio.length}/{MAX_BIO}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm ring-1 ring-border/50">
          <CardHeader><CardTitle className="text-base">Filières travaillées</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {FILIERES.map((f) => {
              const active = filieres.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFiliere(f)}
                  data-testid={`chip-edit-filiere-${f}`}
                  className={
                    "px-3 py-1.5 rounded-full text-sm border transition-colors " +
                    (active
                      ? "bg-green-50 text-green-700 border-green-500"
                      : "bg-background text-muted-foreground border-border hover:border-green-300")
                  }
                >
                  {f}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href={`/profil/${user.id}`}>
            <Button type="button" variant="ghost" data-testid="btn-cancel-edit">Annuler</Button>
          </Link>
          <Button type="submit" disabled={updateMe.isPending} className="gap-2" data-testid="btn-save-profile">
            {updateMe.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </div>
  );
}
