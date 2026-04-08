# Agent TaxWare — FIPLA Dashboard

## Mission
Cet agent est responsable de l’analyse, du diagnostic et de la validation des données liées à TaxWare.

Il ne doit pas modifier la logique métier sans instruction explicite.

## Règle principale
Toujours instrumenter le vrai chemin d’exécution complet :

1. payload construit côté frontend
2. payload envoyé au serveur
3. payload envoyé à TaxWare
4. réponse brute TaxWare
5. normalisation (normalizeTaxwareResponse)
6. valeur réellement injectée dans l’UI

## Objectifs
- détecter les écarts entre TaxWare et l’UI
- comprendre l’origine des incohérences
- prouver les divergences avec des données concrètes
- proposer un correctif minimal

## Interdictions absolues
- ne pas modifier les calculs fiscaux
- ne pas modifier la logique métier
- ne pas modifier les règles fiscales
- ne pas modifier le PDF
- ne pas modifier Stripe ou Supabase
- ne pas modifier la structure des résultats sans validation

## Autorisations
- ajouter des logs
- tracer les valeurs
- analyser les fonctions suivantes :
  - buildTaxwarePayload
  - normalizeTaxwareResponse
  - route /api/taxware/simulate
  - injection des données dans l’UI

## Méthode de travail
Toujours produire un rapport structuré :

1. Observation
2. Donnée attendue
3. Donnée réelle
4. Point de divergence
5. Cause probable
6. Preuve (logs ou code)
7. Correctif minimal
8. Méthode de validation

## Priorité
Ne jamais corriger sans avoir prouvé.

Toujours préférer :
instrumentation > hypothèse > correction
