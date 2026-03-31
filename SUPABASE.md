# Supabase foundation for fipla-dashboard

## A. État existant
- Aucun code Supabase n’était présent dans `src` (aucune initialisation, aucun usage).
- Le `package.json` ne contenait pas de dépendance `@supabase/supabase-js`.
- Il n’y avait pas de variables d’environnement Supabase configu-rées (seulement TaxWare déjà présentes dans `src/server/.env`).

## B. Structure du projet ajoutée
- `src/lib/supabase/client.ts` : client partagé pour frontend et server
- `src/lib/supabase/types.ts` : types métier pour tables attendues
- `SUPABASE.md` : documentation de l’état et des prochaines étapes
- `package.json` : dépendance `@supabase/supabase-js` ajoutée

## C. Variables d’environnement à définir
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL (réutilisation possible côté server)
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-only, accès write) 

## D. Tables métier recommandées (Supabase/Postgres)
- profiles
- organizations
- memberships
- plans
- subscriptions
- org_usage_monthly

## D2. SQL de création
- `SUPABASE_SCHEMA.sql` : schéma complet des tables avec champs Stripe et quotas

## E. Ce qu’il reste à faire pour Stripe
1. Installer et configurer `@stripe/stripe-node` côté serveur.
2. Créer des webhooks pour `invoice.payment_succeeded`, `customer.subscription.updated` et `customer.subscription.deleted`.
3. Lier `plans.stripe_price_id` et `subscriptions.stripe_subscription_id`.
4. Intégrer l’accès aux appels Stripe depuis l’API backend, puis mapping vers Supabase (inscription/renouvellement).

## F. Garanties
- Aucun changement sur : calculs métier, TaxWare, PDF.
- Migration additive (couche d’infrastructure seulement).
