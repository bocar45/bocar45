import { l } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="font-display text-3xl">{l(lang, "Connexion", "Sign in")}</h1>
      <p className="text-muted">{l(lang, "Recevez un code par SMS sur votre numéro. Pas de mot de passe à retenir.", "Get a code by SMS on your phone. No password to remember.")}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
