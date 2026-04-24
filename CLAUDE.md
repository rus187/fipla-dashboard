# FIPLA Dashboard — Règles projet Claude Code

## Règles TaxWare — Changement de domicile

### Endpoint validé

```
POST /api/V1/IncomeAssetTaxDetailed/IncomeAssetTaxDetailed
```

Ne jamais utiliser un autre endpoint pour les simulations de changement de domicile.

### Champs attendus en réponse TaxWare

- `TaxableIncomeCanton`
- `TaxableIncomeFederal`
- `TaxableAssets`
- `TaxTotal`
- `TaxesIncome.MarginalTaxRate`
- Détails par niveau : impôt fédéral, cantonal, communal

### Règles impératives

1. **Ne jamais transporter un revenu imposable d'un canton à l'autre.** Chaque domicile (origine et destination) doit faire l'objet d'un appel TaxWare distinct avec le `Zip` et la `City` correspondants.
2. **Un calcul TaxWare par domicile.** Deux simulations = deux appels API séparés.

### Règle de debug

Instrumenter systématiquement le chemin complet :

```
payload envoyé → réponse brute TaxWare → normalisation → valeur injectée dans l'UI
```

Ne jamais diagnostiquer un écart de valeur sans avoir tracé chacune de ces étapes.

## Règles d'intégration TaxWare

- Toujours laisser TaxWare calculer les bases imposables — ne jamais injecter directement `TaxableIncomeCanton`, `TaxableIncomeFederal` ou `TaxableAssets`.
- Toujours partir des données économiques brutes : revenus, fortune, dettes, immobilier.
- Ne jamais reconstituer un total d'impôt côté application si TaxWare le fournit.
- Toujours utiliser la réponse normalisée comme source unique de vérité.

## Règles de non-régression

- Ne jamais modifier les calculs fiscaux validés.
- Ne jamais altérer les résultats retournés par TaxWare.
- Ne pas modifier la logique des cantons déjà testés sans validation explicite.
- Toute modification doit être vérifiée sur le chemin complet : payload envoyé → réponse brute TaxWare → normalisation → valeur affichée UI.
- En cas de doute : instrumenter le flux complet avant toute modification.

## Règles simulateur "Changement de domicile"

- Toujours effectuer **2 appels TaxWare distincts** : un pour le domicile actuel, un pour le domicile cible.
- Ne jamais réutiliser une base imposable d'un canton pour un autre.
- Chaque simulation doit être recalculée entièrement par TaxWare avec son propre `Zip` et sa propre `City`.
- Ne jamais mélanger les résultats entre variantes.

## Règles d'architecture

- Ne pas appeler TaxWare directement depuis le frontend.
- Toujours passer par une route serveur (`/api/...`).
- Respecter la séparation stricte frontend / backend.
- Ne pas introduire de logique fiscale côté frontend.

## Référence payload

### Payload de référence validé

```json
{
  "Year": 2026,
  "Partnership": "Single",
  "NumChildren": 0,
  "PersonLeading": {
    "Denomination": "Undefined",
    "NetWages": 0,
    "OtherIncome": 0,
    "TravelCosts": 0,
    "ThirdPillarContribution": 0,
    "HasLobContributions": true,
    "LobContributions": 0,
    "OtherOccupationalExpenses": 0,
    "LunchOutExpenses": 0,
    "WeeklyStayExpenses": 0,
    "BusinessIncome": 0,
    "BusinessAssets": 0,
    "PensionIncome": 0,
    "HasOasiPensions": true,
    "InstructionCosts": 0
  },
  "PersonSecond": {
    "Denomination": "Undefined",
    "NetWages": 0,
    "OtherIncome": 0,
    "TravelCosts": 0,
    "ThirdPillarContribution": 0,
    "HasLobContributions": true,
    "LobContributions": 0,
    "OtherOccupationalExpenses": 0,
    "LunchOutExpenses": 0,
    "WeeklyStayExpenses": 0,
    "BusinessIncome": 0,
    "BusinessAssets": 0,
    "PensionIncome": 0,
    "HasOasiPensions": true,
    "InstructionCosts": 0
  },
  "MiscIncome": 0,
  "MiscExpenses": 0,
  "Assets": 0,
  "AssetIncome": 0,
  "PrivilegedDividends": 0,
  "PrivilegedParticipations": 0,
  "Debts": 0,
  "DebtInterests": 0,
  "RealEstates": [
    {
      "TaxableValue": 0,
      "RentalIncome": 0,
      "EffectiveExpenses": 0,
      "ConstructionYear": 0
    }
  ],
  "Zip": 0,
  "City": "string"
}
```
