import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/components/auth-provider";
import { useLoginUser } from "@/api-client";
import { useToast } from "@/hooks/use-toast";

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
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Adresse email invalide" }),
  password: z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          toast({
            title: "Connexion réussie",
            description: `Bienvenue, ${data.user.name}`,
          });
          
          const role = data.user.role as string;
          const ADMIN = new Set(["admin", "super_admin", "moderateur", "support", "finance", "commercial"]);
          if ((data.user as any).forcePasswordChange && ADMIN.has(role)) {
            setLocation("/admin/changer-mot-de-passe");
          } else if (ADMIN.has(role)) {
            setLocation("/admin");
          } else if (role === "producteur") {
            setLocation("/dashboard/producteur");
          } else {
            setLocation("/dashboard/transformateur");
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erreur de connexion",
            description: error.data?.error || "Vérifiez vos identifiants et réessayez.",
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] py-12 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img
            src="/brand/agroloop-logo-light.png"
            alt="AgroLoopCI"
            className="h-16 w-auto"
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Bon retour</CardTitle>
            <CardDescription className="text-muted-foreground">
              Connectez-vous pour accéder à votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="kouameparfait@email.com" type="email" autoComplete="email" {...field} data-testid="input-login-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Mot de passe</FormLabel>
                      </div>
                      <FormControl>
                        <PasswordInput placeholder="••••••••" autoComplete="current-password" {...field} data-testid="input-login-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full mt-6" 
                  disabled={loginMutation.isPending}
                  data-testid="button-login-submit"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-center gap-2 border-t px-6 py-4 text-sm text-muted-foreground">
            <span>Vous n'avez pas de compte ?</span>
            <Link href="/register" className="font-semibold text-primary hover:underline" data-testid="link-login-register">
              S'inscrire
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
