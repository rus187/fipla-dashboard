# Mode d'Emploi du Simulateur "Changement de Domicile" - FIPLA Dashboard

## Introduction

Le simulateur "Changement de domicile" est un outil interactif de l'application FIPLA Dashboard qui vous permet de comparer l'impact fiscal d'un déménagement entre deux communes suisses. Il recalcule automatiquement vos impôts selon les règles fiscales du canton et de la commune cible, en tenant compte de votre situation personnelle et financière.

**Objectif** : Évaluer si un changement de domicile est fiscalement avantageux, neutre ou défavorable.

**Plateforme** : Disponible principalement sur l'interface mobile/conseiller.

---

## Prérequis

Avant de commencer la simulation :

- **Connexion** : Vous devez être connecté à votre compte FIPLA Dashboard.
- **Données fiscales** : Préparez vos informations fiscales récentes (revenus, fortune, etc.).
- **Crédits** : Assurez-vous d'avoir des crédits de simulation disponibles (gérés via Supabase).
- **Navigateur** : Compatible avec les navigateurs modernes (Chrome, Safari, Firefox).

**Important** : Le simulateur utilise l'API TaxWare pour des calculs fiscaux précis. Les résultats sont des estimations basées sur les données fournies.

---

## Étapes Détaillées de la Simulation

Le simulateur se déroule en **6 étapes séquentielles**. Vous pouvez naviguer entre les étapes via les onglets en haut de l'écran.

### Étape 1 : Identité

**Objectif** : Saisir vos informations personnelles de base.

**Champs à remplir** :
- **Prénom** : Votre prénom (obligatoire).
- **Nom** : Votre nom de famille (obligatoire).
- **État civil** : Sélectionnez parmi les options disponibles (célibataire, marié, etc.) (obligatoire).
- **Nombre d'enfants** : Indiquez le nombre d'enfants à charge (0 si aucun).

**Conseils** :
- Ces informations sont sauvegardées automatiquement dans votre dossier actif.
- Elles influencent les calculs fiscaux (déductions familiales, etc.).

**Action** : Cliquez sur "Continuer" pour passer à l'étape suivante.

---

### Étape 2 : Domicile Actuel

**Objectif** : Définir votre lieu de résidence actuel.

**Champs à remplir** :
- **NPA actuel** : Code postal suisse (4 chiffres, obligatoire).
- **Localité actuelle** : Nom de la commune (avec autocomplétion).

**Fonctionnalités** :
- **Autocomplétion** : Tapez le nom de la commune pour voir des suggestions. La recherche est insensible à la casse et affiche jusqu'à 8 propositions.
- **Résolution automatique** : Si vous entrez un NPA valide, la commune correspondante est proposée automatiquement.
- **Validation** : Le NPA doit être valide (au moins 4 caractères).

**Conseils** :
- Utilisez le nom exact de la commune pour une précision maximale.
- Ces données sont sauvegardées dans votre dossier client pour référence future.

**Action** : Cliquez sur "Passer au nouveau domicile" pour continuer.

---

### Étape 3 : Nouveau Domicile

**Objectif** : Spécifier le lieu de résidence envisagé.

**Champs à remplir** :
- **NPA nouveau** : Code postal de la commune cible (4 chiffres, obligatoire).
- **Localité nouvelle** : Nom de la commune cible (avec autocomplétion).

**Fonctionnalités** :
- Même autocomplétion que l'étape 2.
- **Non sauvegardé** : Contrairement au domicile actuel, ces données restent temporaires jusqu'à la simulation.

**Conseils** :
- Comparez des communes réalistes pour des résultats pertinents.
- Vérifiez l'orthographe pour éviter les erreurs.

**Action** : Cliquez sur "Passer aux données fiscales" pour continuer.

---

### Étape 4 : Données Fiscales

**Objectif** : Fournir vos bases fiscales pour le calcul.

**Champs à remplir** (tous obligatoires) :
- **Revenu imposable IFD (fédéral)** : Votre revenu imposable au niveau fédéral (en CHF).
- **Revenu imposable ICC (cantonal)** : Votre revenu imposable au niveau cantonal (en CHF).
- **3e pilier** : Montant des cotisations au 3e pilier (en CHF, minimum 0).
- **Rachat LPP** : Montant du rachat de fonds de pension (en CHF, minimum 0).
- **Fortune imposable** : Valeur de votre fortune taxable (en CHF).

**Validation** :
- Tous les champs doivent être remplis.
- Les montants ne peuvent pas être négatifs.
- Le bouton "Afficher la comparaison" est désactivé tant que la validation échoue.

**Conseils** :
- Utilisez vos dernières déclarations fiscales pour des données précises.
- Les montants sont arrondis automatiquement selon les règles fiscales.

**Action** : Cliquez sur "Afficher la comparaison" pour lancer le calcul (peut prendre quelques secondes).

---

### Étape 5 : Comparaison Visuelle

**Objectif** : Visualiser les résultats de la comparaison.

**Affichage** : Trois cartes côte à côte.

1. **Domicile actuel** :
   - Montant total des impôts actuels (en CHF).
   - Description : "Impôts au domicile actuel".
   - Métriques détaillées : IFD, cantonal, communal, fortune.

2. **Domicile cible** :
   - Montant total des impôts après changement (en CHF).
   - Description : "Impôts au domicile cible".
   - Métriques détaillées identiques.

3. **Différence** :
   - Écart entre les deux montants (positif = économie, négatif = surcoût).
   - Verdict : "Favorable" (économie), "Neutre" (aucun changement), ou "Défavorable" (surcoût).
   - Métriques détaillées de la différence.

**Fonctionnalités** :
- Montants formatés en CHF avec séparateurs d'espaces.
- Indicateurs visuels pour le verdict.

**Action** : Cliquez sur "Voir le détail" pour accéder aux explications complètes.

---

### Étape 6 : Détail Complet

**Objectif** : Consulter une décomposition détaillée des calculs.

**Affichage** : Sections accordéon (déroulantes).

- **Décomposition par impôt** : IFD fédéral, cantonal, communal, fortune.
- **Bases fiscales** : Revenus recalculés selon les règles du canton cible.
- **Taux appliqués** : Pourcentages utilisés dans les calculs.

**Navigation** : Utilisez les onglets en haut pour revenir aux étapes précédentes et modifier les données si nécessaire.

**Conseils** :
- Imprimez ou sauvegardez ces détails pour vos dossiers.
- Les calculs sont basés sur TaxWare pour une précision maximale.

---

## Fonctionnalités Avancées

### Modes de Simulation
- **Simulation réelle** : Recalcule toutes les bases fiscales selon les règles du canton cible (précis mais plus lent).
- **Estimation rapide** : Compare les communes avec les mêmes bases (rapide, ordre de grandeur).

### Persistance des Données
- Vos données d'identité et de domicile actuel sont sauvegardées automatiquement.
- Le domicile cible reste temporaire pour permettre des explorations multiples.

### Intégrations
- **TaxWare** : Moteur de calcul fiscal officiel suisse.
- **Lookup géographique** : Base de données des communes suisses pour autocomplétion.

---

## Conseils et Astuces

- **Précision des données** : Plus vos informations sont exactes, plus les résultats le sont.
- **Comparaisons multiples** : Modifiez le domicile cible pour explorer plusieurs options sans ressaisir les données de base.
- **Interprétation** : Un verdict "Favorable" ne signifie pas toujours déménager (considérez les coûts de déménagement, qualité de vie, etc.).
- **Mise à jour** : Actualisez vos données fiscales annuellement pour des simulations pertinentes.
- **Support** : En cas de doute, consultez un fiscaliste ou contactez le support FIPLA.

---

## Dépannage

### Problèmes Courants

- **Bouton "Afficher la comparaison" désactivé** : Vérifiez que tous les champs obligatoires sont remplis et valides.
- **Erreur lors de la comparaison** : Vérifiez votre connexion internet et vos crédits. Réessayez ou contactez le support.
- **Autocomplétion ne fonctionne pas** : Tapez au moins 3 caractères. Si le problème persiste, saisissez manuellement.
- **Résultats inattendus** : Assurez-vous que les NPA correspondent à des communes fiscales valides.
- **Chargement lent** : Les calculs TaxWare peuvent prendre du temps ; patientez.

### Messages d'Erreur
- "Erreur lors de la comparaison domicile" : Problème avec l'API TaxWare. Réessayez plus tard.
- Crédits insuffisants : Rechargez vos crédits via l'application.

### Support
Si vous rencontrez un problème non résolu, contactez l'équipe FIPLA via l'application ou par email.

---

**Version du mode d'emploi** : 1.0 (Avril 2026)  
**Application** : FIPLA Dashboard  
**Simulateur** : Changement de domicile</content>
<parameter name="filePath">d:\Russo\CloudStation\fipla-dashboard\MODE_D_EMPLOI_CHANGEMENT_DOMICILE.md