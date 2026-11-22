# Mise en route Supabase + Vercel

À faire par le porteur du projet (ou avec son accord explicite). Aucun compte n'a été créé et rien n'a été déployé.

## 1. Supabase
1. Créer un projet sur supabase.com, région **eu-west-3 (Paris)**, offre Pro pour la production (≈ 25 $/mois ; l'offre gratuite suffit pour tester).
2. Appliquer les migrations depuis le dépôt :
   ```bash
   npx supabase login
   npx supabase link --project-ref <réf-du-projet>
   npx supabase db push            # applique supabase/migrations/*
   psql "<chaîne de connexion>" -f supabase/seed.sql
   ```
3. **Authentification → Providers → Phone** : activer, choisir un fournisseur SMS (Twilio, MessageBird, Vonage ou Textlocal). Twilio permet aussi l'envoi par **WhatsApp**. Coût à l'usage (≈ 0,03–0,08 $ par SMS vers le Sénégal, à vérifier).
4. **Authentification → Rate Limits** : garder une limite d'envoi de SMS (ex. 30 par heure pour tout le projet) en plus des limites de SAWWA (5 codes par numéro et 20 par adresse réseau et par heure, `apps/web/src/lib/rate-limit.ts`). Chaque SMS est facturé.
5. **Authentification → URL Configuration** : Site URL = l'adresse du site ; ajouter `https://<domaine>/auth/callback` aux Redirect URLs. Les liens de connexion par e-mail utilisent `NEXT_PUBLIC_SITE_URL` : sur un déploiement de prévisualisation, renseigner cette variable avec l'adresse de ce déploiement (et l'autoriser dans Redirect URLs), sinon le lien renverra vers le site principal.
6. Désigner le premier super administrateur (après sa première connexion) :
   ```sql
   insert into public.memberships (user_id, organization_id, role)
   select u.id, o.id, 'super_admin' from auth.users u, public.organizations o
   where u.phone = '221XXXXXXXXX' and o.kind = 'platform';
   ```

## 2. Vercel
1. Importer le dépôt GitHub, **Root Directory = `apps/web`** (Vercel détecte pnpm et le monorepo).
2. Variables d'environnement (Production et Preview) :
   | Variable | Où la trouver |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé publique) |
   | `SUPABASE_SERVICE_ROLE_KEY` | idem (**secrète**, serveur uniquement) |
   | `NEXT_PUBLIC_SITE_URL` | l'adresse du site |
3. Région des fonctions : `cdg1` (Paris), déjà fixée dans `apps/web/vercel.json`.
4. Offre Pro pour un usage commercial (≈ 20 $/mois par membre).

## 3. En local
```bash
cp apps/web/.env.example apps/web/.env.local   # renseigner les valeurs d'un projet Supabase de test
pnpm install
pnpm --filter web dev                           # http://localhost:3000
pnpm test && pnpm db:test                       # tests métier + migrations et règles d'accès
```
`pnpm db:test` n'a besoin ni de Docker ni de Supabase : il rejoue les migrations sur un Postgres local jetable.

## 4. Types TypeScript de la base
Une fois le projet créé : `npx supabase gen types typescript --project-id <réf> > apps/web/src/lib/supabase/database.types.ts`, puis typer les clients avec. En attendant, les lectures sont typées à la main dans `src/lib/auth.ts`.

## Important : variables au moment du build
La politique de sécurité du site (CSP, E24a) autorise Supabase à partir de `NEXT_PUBLIC_SUPABASE_URL` **lue au build**. Sur Vercel, cette variable doit être définie pour l'environnement de build (Production et Preview), sinon le navigateur bloquera les appels à Supabase. Après l'avoir ajoutée ou modifiée, relancer un déploiement.
`NEXT_PUBLIC_SITE_URL` (adresse définitive du site, ex. `https://www.<domaine>`) doit aussi être défini au build : il sert aux adresses canoniques, au plan du site, aux liens de partage et aux e-mails de connexion.
