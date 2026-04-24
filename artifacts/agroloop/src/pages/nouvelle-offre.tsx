import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetMesOffresQueryKey, getGetDashboardProducteurQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, MapPin, ArrowLeft, Truck } from "lucide-react";
import { useState } from "react";
import { PhotoUploader, type UploadedPhoto, MIN_PHOTOS } from "@/components/photo-uploader";

const RESIDU_TYPES = [
  "Cabosses de cacao",
  "Coques d'anacarde",
  "Tiges de plantain",
  "Feuilles de canne à sucre",
  "Marc de café",
  "Écorces de manioc",
  "Pailles de riz",
  "Autre"
] as const;

const REGIONS = [
  "Abidjan", 
  "San Pedro", 
  "Abengourou", 
  "Bouaké", 
  "Korhogo", 
  "Yamoussoukro", 
  "Autre"
] as const;

const offreSchema = z.object({
  typeResidu: z.string().min(1, { message: "Veuillez sélectionner un type de résidu" }),
  quantityKg: z.coerce.number().positive({ message: "La quantité doit être supérieure à 0" }),
  priceFcfa: z.coerce.number().nonnegative({ message: "Le prix ne peut pas être négatif" }),
  region: z.string().min(1, { message: "Veuillez sélectionner une région" }),
  description: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  disponibilite: z.enum(["immediate", "planifiee"]).default("immediate"),
  dateDisponibilite: z.string().optional(),
  livraisonPossible: z.boolean().default(false),
});

export default function NouvelleOffre() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLocating, setIsLocating] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const createOffreMutation = useMutation({
    mutationFn: async (body: any) => {
      return customFetch<any>("/api/offres", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  });

  const form = useForm<z.infer<typeof offreSchema>>({
    resolver: zodResolver(offreSchema),
    defaultValues: {
      typeResidu: "",
      quantityKg: 0,
      priceFcfa: 0,
      region: "",
      description: "",
      disponibilite: "immediate",
      dateDisponibilite: "",
      livraisonPossible: false,
    },
  });

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La géolocalisation n'est pas supportée par votre navigateur.",
      });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude);
        form.setValue("longitude", position.coords.longitude);
        setIsLocating(false);
        toast({ title: "Position trouvée", description: "Vos coordonnées ont été ajoutées avec succès." });
      },
      () => {
        setIsLocating(false);
        toast({ variant: "destructive", title: "Erreur de géolocalisation", description: "Impossible d'obtenir votre position. Veuillez vérifier vos autorisations." });
      }
    );
  };

  const validPhotos = photos.filter((p) => p.status === "done");
  const meetsMin = validPhotos.length >= MIN_PHOTOS;
  const hasUploading = photos.some((p) => p.status === "uploading");

  const onSubmit = (values: z.infer<typeof offreSchema>) => {
    if (!meetsMin) {
      toast({ variant: "destructive", title: "Photos requises", description: `Veuillez ajouter au moins ${MIN_PHOTOS} photos.` });
      return;
    }
    createOffreMutation.mutate(
      {
        ...values,
        photos: validPhotos.map((p) => p.dataUrl),
        file_names: validPhotos.map((p) => p.fileName),
      },
      {
        onSuccess: () => {
          toast({ title: "Offre publiée", description: "Votre offre de résidus a été publiée avec succès." });
          queryClient.invalidateQueries({ queryKey: getGetMesOffresQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardProducteurQueryKey() });
          setLocation("/dashboard/producteur");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Erreur",
            description: error?.data?.error || error?.message || "Une erreur est survenue lors de la publication.",
          });
        },
      }
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard/producteur")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouvelle Offre</h1>
          <p className="text-muted-foreground mt-1">Publiez vos résidus agricoles sur la marketplace</p>
        </div>
      </div>

      <Card className="border-none shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle>Détails de l'offre</CardTitle>
          <CardDescription>Remplissez les informations sur les résidus que vous souhaitez vendre.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Photos de l'offre <span className="text-red-600">*</span></h3>
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="typeResidu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de résidu agricole</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-offre-type">
                            <SelectValue placeholder="Sélectionnez un type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESIDU_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Région</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-offre-region">
                            <SelectValue placeholder="Sélectionnez une région" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REGIONS.map((region) => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quantityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité disponible (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="any" {...field} data-testid="input-offre-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priceFcfa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix total (FCFA)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="any" {...field} data-testid="input-offre-price" />
                      </FormControl>
                      <FormDescription>Le prix pour la quantité totale</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Précisez les conditions de stockage, d'accès, etc."
                        className="resize-none min-h-[100px]"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-offre-desc"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="disponibilite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Disponibilité</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-offre-disponibilite">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="immediate">Immédiate</SelectItem>
                          <SelectItem value="planifiee">Planifiée</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("disponibilite") === "planifiee" && (
                  <FormField
                    control={form.control}
                    name="dateDisponibilite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de disponibilité</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-offre-date-disponibilite" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="livraisonPossible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 p-4">
                    <div className="space-y-1">
                      <FormLabel className="flex items-center gap-2 text-sm font-medium">
                        <Truck className="h-4 w-4 text-primary" />
                        Livraison possible
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Activez si vous pouvez livrer ces résidus à l'acheteur (sera mis en avant sur la carte et dans les filtres)
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-livraison-possible"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Localisation précise (optionnel)</h4>
                    <p className="text-xs text-muted-foreground mt-1">Aide les acheteurs à évaluer les coûts de transport</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeolocation}
                    disabled={isLocating}
                    className="gap-2"
                  >
                    {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    Me localiser
                  </Button>
                </div>

                {(form.watch("latitude") && form.watch("longitude")) && (
                  <div className="text-xs font-medium text-primary flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Coordonnées enregistrées: {form.watch("latitude")?.toFixed(4)}, {form.watch("longitude")?.toFixed(4)}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
                <Button type="button" variant="outline" onClick={() => setLocation("/dashboard/producteur")}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createOffreMutation.isPending || !meetsMin || hasUploading}
                  data-testid="button-offre-submit"
                  title={!meetsMin ? `Ajoutez au moins ${MIN_PHOTOS} photos` : undefined}
                >
                  {createOffreMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publication...</>
                  ) : "Publier l'offre"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
