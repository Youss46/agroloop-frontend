import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useRegisterUser } from "@/api-client";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Sprout, Recycle } from "lucide-react";

const REGIONS = [
  "Abidjan",
  "San Pedro",
  "Abengourou",
  "Bouaké",
  "Korhogo",
  "Daloa",
  "Man",
  "Yamoussoukro",
  "Autre",
] as const;

const registerSchema = z.object({
  name: z.string().min(2, { message: "Le nom est requis (min 2 caractères)" }),
  email: z.string().email({ message: "Adresse email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
  role: z.enum(["producteur", "transformateur"], { required_error: "Veuillez sélectionner un rôle" }),
  phone: z.string().optional(),
  region: z.string().optional(),
});

export default function Register() {
  useSEO({
    title: "Inscription",
    description: "Rejoignez AgroLoopCI et commencez à valoriser vos résidus agricoles ou à trouver des matières premières secondaires.",
    url: "/register",
  });
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const registerMutation = useRegisterUser();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "producteur",
      phone: "",
      region: "Abidjan",
    },
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          toast({
            title: "Inscription réussie",
            description: `Bienvenue sur AgroLoopCI, ${data.user.name}`,
          });
          
          if (data.user.role === "producteur") {
            setLocation("/dashboard/producteur");
          } else {
            setLocation("/dashboard/transformateur");
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erreur d'inscription",
            description: error.data?.error || "Une erreur est survenue lors de l'inscription.",
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] py-12 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="w-full max-w-xl">
        <div className="flex justify-center mb-8">
          <img
            src="/brand/agroloop-logo-light.png"
            alt="AgroLoopCI"
            className="h-16 w-auto"
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Créer un compte</CardTitle>
            <CardDescription className="text-muted-foreground">
              Rejoignez la plateforme d'économie circulaire agricole
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Je suis un...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                          data-testid="radiogroup-register-role"
                        >
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="producteur" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/5 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer">
                              <Sprout className="mb-3 h-8 w-8 text-primary" />
                              <span className="font-semibold text-base">Producteur</span>
                              <span className="mt-1 text-xs text-center font-normal text-muted-foreground">Je vends des résidus</span>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormControl>
                              <RadioGroupItem value="transformateur" className="peer sr-only" />
                            </FormControl>
                            <FormLabel className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/5 hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer">
                              <Recycle className="mb-3 h-8 w-8 text-primary" />
                              <span className="font-semibold text-base">Transformateur</span>
                              <span className="mt-1 text-xs text-center font-normal text-muted-foreground">J'achète des résidus</span>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom complet / Entreprise</FormLabel>
                        <FormControl>
                          <Input placeholder="Kouamé Parfait" {...field} data-testid="input-register-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="kouameparfait@email.com" type="email" {...field} data-testid="input-register-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone WhatsApp</FormLabel>
                        <FormControl>
                          <Input placeholder="+225 01 23 45 67 89" type="tel" {...field} data-testid="input-register-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Région principale</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="select-register-region"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {REGIONS.map((region) => (
                              <option key={region} value={region}>
                                {region}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" {...field} data-testid="input-register-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full mt-6" 
                  size="lg"
                  disabled={registerMutation.isPending}
                  data-testid="button-register-submit"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Inscription en cours...
                    </>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-center gap-2 border-t px-6 py-4 text-sm text-muted-foreground">
            <span>Vous avez déjà un compte ?</span>
            <Link href="/login" className="font-semibold text-primary hover:underline" data-testid="link-register-login">
              Se connecter
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
