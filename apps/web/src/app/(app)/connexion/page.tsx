import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-md gap-6">
      <h1 className="font-display text-3xl">Connexion</h1>
      <p className="text-muted">Recevez un code par SMS sur votre numéro. Pas de mot de passe à retenir.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
