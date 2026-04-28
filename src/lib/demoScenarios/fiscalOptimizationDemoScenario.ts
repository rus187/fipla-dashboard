// Scénario de démonstration destiné aux tests manuels et aux présentations internes.
// Ne pas utiliser comme source de calcul métier.
//
// Usage : ce fichier documente le cas de démonstration de référence du module
// d'optimisations fiscales FIPLA. Il permet de vérifier manuellement chaque
// étape du circuit : TaxWare standard → optimisations FIPLA indicatives →
// lecture cantonale → synthèse conseiller.

// ─── Scénario de démonstration ───────────────────────────────────────────────

export const fiscalOptimizationDemoScenario = {

  // ── 1. Profil ──────────────────────────────────────────────────────────────
  profile: {
    situationFamiliale: "Couple marié",
    canton: "NE",
    commune: "Neuchâtel",
    description:
      "Couple actif, domicilié à Neuchâtel (NE). Associé majoritaire d'une PME locale. Cherche à optimiser la pression fiscale avant retraite.",
  },

  // ── 2. TaxWare standard ────────────────────────────────────────────────────
  // Source : résultat normalisé de l'endpoint TaxWare.
  // Ces valeurs ne doivent pas être modifiées par FIPLA.
  taxwareStandard: {
    revenuImposableCanton: 150_000,
    fortuneImposableCanton: 500_000,
    impotTotal: 18_000,

    formatted: {
      revenuImposableCanton: "150'000 CHF",
      fortuneImposableCanton: "500'000 CHF",
      impotTotal: "18'000 CHF",
    },
  },

  // ── 3. 3e pilier A ─────────────────────────────────────────────────────────
  // Plafond et taux temporaires (TEMP_IFD_3A_MAX_WITH_LPP_PER_PERSON, TEMP_MARGINAL_TAX_RATE).
  // À raccorder au référentiel légal dans une phase future.
  threePillar: {
    versementActuel: 5_000,
    plafondCouple: 14_516,        // 2 × 7 258 CHF (plafond 2026 avec LPP)
    potentielRestant: 9_516,       // 14 516 − 5 000
    tauxMarginalEstime: 0.30,      // estimation temporaire
    gainFiscalEstime: 2_854.80,    // 9 516 × 0.30

    noteTemporaire:
      "Le plafond et le taux marginal sont temporaires. Une version future les reliera au référentiel légal et à l'endpoint TaxWare.",

    projection: {
      annees: 10,
      tauxRendementAnnuel: 0.02,   // hypothèse temporaire
      tauxImpositionSortie: 0.08,  // estimation temporaire
      versementsCumules: 95_160,
      capitalEstime: 104_198,
      economieFiscaleCumulee: 28_548,
      impotSortieEstime: 8_336,
      gainNetEstime: 29_250,

      formatted: {
        versementsCumules: "95'160 CHF",
        capitalEstime: "104'198 CHF",
        economieFiscaleCumulee: "28'548 CHF",
        impotSortieEstime: "8'336 CHF",
        gainNetEstime: "29'250 CHF",
      },
    },

    formatted: {
      versementActuel: "5'000 CHF",
      plafondCouple: "14'516 CHF",
      potentielRestant: "9'516 CHF",
      gainFiscalEstime: "2'855 CHF",
    },
  },

  // ── 4. Rachat LPP ──────────────────────────────────────────────────────────
  // Le rachat LPP réduit le revenu imposable (affectsTaxableIncome: true)
  // mais NE réduit PAS le revenu budgétaire interne (affectsBudgetIncome: false).
  // Il mobilise la fortune liquide (affectsLiquidWealth: true).
  lppBuyback: {
    rachatSimule: 20_000,
    tauxMarginalEstime: 0.30,
    gainFiscalEstime: 6_000,       // 20 000 × 0.30
    fortuneLiquideDisponible: 50_000,
    fortuneLiquideRestante: 30_000, // 50 000 − 20 000

    impacts: {
      affectsTaxableIncome: true,  // réduit le revenu imposable
      affectsBudgetIncome: false,  // NE réduit PAS le revenu budgétaire
      affectsLiquidWealth: true,   // mobilise la fortune liquide
    },

    noteMetier:
      "Le rachat LPP ne doit pas être soustrait des revenus dans le contrôle budgétaire interne. Vérifier la capacité de rachat disponible avec le certificat de prévoyance.",

    formatted: {
      rachatSimule: "20'000 CHF",
      gainFiscalEstime: "6'000 CHF",
      fortuneLiquideDisponible: "50'000 CHF",
      fortuneLiquideRestante: "30'000 CHF",
    },
  },

  // ── 5. Valorisation entreprise ─────────────────────────────────────────────
  // Méthode des praticiens suisses (circulaire AFC) :
  //   earningsValue    = averageProfit / capitalizationRate
  //   fullCompanyValue = (2 × earningsValue + intrinsicValue) / 3
  //   ownedCompanyValue = fullCompanyValue × ownershipPercentage
  //
  // Cette valeur est injectée uniquement dans la lecture cantonale indicative.
  // Elle n'est PAS envoyée à TaxWare dans cette phase.
  companyValuation: {
    benefices: [200_000, 180_000, 220_000],
    beneficeMoyen: 200_000,
    valeurIntrinsèque: 1_000_000,
    tauxCapitalisation: 0.08,
    participationPourcentage: 1,

    // Calcul praticiens :
    //   earningsValue    = 200 000 / 0.08       = 2 500 000
    //   fullCompanyValue = (5 000 000 + 1 000 000) / 3 = 2 000 000
    //   ownedCompanyValue = 2 000 000 × 1       = 2 000 000
    valeurRendement: 2_500_000,
    valeurFiscaleEntreprise: 2_000_000,
    valeurDetenue: 2_000_000,

    noteInjection:
      "Injection locale uniquement : non transmise à TaxWare. Sert uniquement à alimenter la lecture cantonale indicative (fortune imposable cantonale).",

    formatted: {
      beneficeMoyen: "200'000 CHF",
      valeurRendement: "2'500'000 CHF",
      valeurFiscaleEntreprise: "2'000'000 CHF",
      valeurDetenue: "2'000'000 CHF",
    },
  },

  // ── 6. Impact cantonal (NE) ────────────────────────────────────────────────
  // applyCantonalRules reçoit privateCompanyTaxValue = 2 000 000
  // Fortune cantonale standard 500 000 + 2 000 000 = 2 500 000 (indicatif)
  cantonalImpact: {
    canton: "NE",
    fortuneStandard: 500_000,
    ajustementFortune: 2_000_000,  // valeur entreprise injectée
    fortuneCorrigeeIndicative: 2_500_000,
    warningAttendue: "ne_private_company_tax_value",

    noteIndicative:
      "La fortune cantonale corrigée est indicative. Les règles cantonales pilotes romandes ne remplacent pas le calcul TaxWare ni une validation fiscale cantonale.",

    formatted: {
      fortuneStandard: "500'000 CHF",
      ajustementFortune: "2'000'000 CHF",
      fortuneCorrigeeIndicative: "2'500'000 CHF",
    },
  },

  // ── 7. Synthèse finale ─────────────────────────────────────────────────────
  finalSummary: {
    impotStandardTaxWare: 18_000,
    gainTroisPilier: 2_854.80,
    gainRachatLPP: 6_000,
    gainFiscalPotentielTotal: 8_854.80,  // 2 854.80 + 6 000
    impotOptimiseIndicatif: 9_145.20,    // 18 000 − 8 854.80

    noteFinale:
      "Le montant optimisé est indicatif : il additionne des leviers potentiels et ne remplace pas un nouveau calcul fiscal définitif via TaxWare.",

    formatted: {
      impotStandardTaxWare: "18'000 CHF",
      gainFiscalPotentielTotal: "8'855 CHF",
      impotOptimiseIndicatif: "9'145 CHF",
    },
  },

  // ── 8. Visual story (messages de démonstration) ───────────────────────────
  visualStory: [
    "Voici le résultat fiscal standard TaxWare.",
    "FIPLA détecte ensuite des leviers d'optimisation indicatifs.",
    "Le 3e pilier montre un potentiel de versement complémentaire.",
    "Le rachat LPP montre un gain fiscal mais mobilise la fortune liquide.",
    "La valeur d'entreprise est intégrée uniquement dans la lecture cantonale indicative.",
    "Le résultat optimisé FIPLA reste une aide à la décision, pas un nouveau calcul officiel.",
  ],

} as const;

// ─── Checklist test manuel ────────────────────────────────────────────────────

export const fiscalOptimizationDemoChecklist = [
  {
    ordre: 1,
    point: "Vérifier que TaxWare standard reste visible",
    detail:
      "Le bloc 'Standard TaxWare vs Optimisé FIPLA' affiche 'Impôt standard TaxWare : 18'000 CHF' en violet.",
    valeurAttendue: "18'000 CHF",
  },
  {
    ordre: 2,
    point: "Vérifier que le gain fiscal potentiel total apparaît",
    detail:
      "Le bloc vert 'Gain fiscal potentiel' affiche Gain 3e pilier A : 2'855 CHF, Gain rachat LPP : 6'000 CHF, Total potentiel : 8'855 CHF.",
    valeurAttendue: "8'855 CHF",
  },
  {
    ordre: 3,
    point: "Vérifier que la projection 3a apparaît",
    detail:
      "La carte 3e pilier A affiche la sous-section 'Projection sur 10 ans' avec capital estimé 104'198 CHF et gain net estimé 29'250 CHF.",
    valeurAttendue: "Capital 104'198 CHF — Gain net 29'250 CHF",
  },
  {
    ordre: 4,
    point: "Vérifier que le rachat LPP affiche bien impact fiscal / budget / fortune",
    detail:
      "La carte Rachat LPP affiche trois tags : 'Revenu imposable ↓' (vert), 'Budget interne =' (vert), 'Fortune liquide ↓' (vert). Disclaimer : 'Le rachat LPP réduit le revenu imposable, mais il est traité comme une sortie de fortune liquide...'",
    valeurAttendue: "Économie 6'000 CHF — Fortune liquide restante 30'000 CHF",
  },
  {
    ordre: 5,
    point: "Vérifier que la valeur entreprise augmente la fortune cantonale indicative",
    detail:
      "Dans le bloc 'Lecture cantonale préparatoire — NE', vérifier : Fortune cantonale standard 500'000 CHF → Ajustements fortune +2'000'000 CHF → Fortune cantonale corrigée indicative 2'500'000 CHF.",
    valeurAttendue: "Fortune corrigée 2'500'000 CHF",
  },
  {
    ordre: 6,
    point: "Vérifier que les disclaimers indicatifs sont visibles",
    detail:
      "Au moins quatre textes prudents doivent être visibles : (1) bandeau gris 'Le calcul TaxWare reste la base fiscale standard', (2) texte vert 'Estimation indicative...', (3) texte violet 'Le montant optimisé est indicatif...', (4) texte gris 'Lecture indicative préparatoire...'.",
    valeurAttendue: "4 disclaimers distincts visibles",
  },
  {
    ordre: 7,
    point: "Vérifier que le build passe sans erreur TypeScript",
    detail: "Lancer npm run build. Résultat attendu : 890 modules transformés, 0 erreur.",
    valeurAttendue: "✓ built — 0 erreur TypeScript",
  },
] as const;
