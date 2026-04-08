# FIPLA Dashboard — règles globales Codex

## Mission générale
Tu travailles sur le projet FIPLA Dashboard.
Tu dois toujours privilégier les changements minimaux, sûrs, traçables et faciles à vérifier.

## Règles absolues
- Ne jamais modifier les calculs fiscaux sans instruction explicite.
- Ne jamais modifier la connexion API TaxWare sans instruction explicite.
- Ne jamais modifier la génération PDF sans instruction explicite.
- Ne jamais modifier la logique sensible liée aux cantons romands concernant la logique enfants / fin de déduction enfant sans instruction explicite.
- Toujours préserver le comportement métier existant.
- Toujours préférer l’instrumentation réelle aux hypothèses théoriques.

## Règle de diagnostic obligatoire
En cas de bug ou d’écart de résultat, instrumenter le vrai chemin d’exécution :
1. payload envoyé
2. réponse brute reçue
3. normalisation
4. valeur réellement injectée dans l’UI

## Format de réponse attendu
Toujours fournir :
- cause probable
- preuve observable
- correctif minimal
- fichiers modifiés
- méthode de validation

## Règles de modification
- Faire des changements minimaux.
- Ne pas refactorer largement sans demande explicite.
- Ne pas déplacer des fichiers sans nécessité.
- Ne pas renommer des fonctions sensibles sans raison forte.
- Dire exactement quels fichiers ont été touchés.
- Protéger en priorité : calculs, TaxWare, PDF, Stripe, Supabase.

## Zones sensibles
Les zones suivantes sont sensibles :
- logique fiscale
- intégration TaxWare
- génération PDF
- logique d’abonnement et d’accès
- règles enfants / déductions des cantons romands

## Priorité de travail
1. comprendre
2. instrumenter
3. prouver
4. corriger au minimum
5. valider
